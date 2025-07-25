const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const router = express.Router();

// 数据库配置
const dbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'two hours'
};

// 创建数据库连接池
const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../voicetotext/inputFiles');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 保持原始文件名，避免编码问题
        cb(null, file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

// 上传文件到inputFiles目录
router.post('/upload-files', upload.array('files'), (req, res) => {
    try {
        console.log('收到文件上传请求');
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: '没有上传文件' });
        }
        
        const uploadedFiles = req.files.map(file => ({
            originalname: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size
        }));
        
        console.log(`成功上传 ${uploadedFiles.length} 个文件`);
        
        res.json({ 
            success: true, 
            files: uploadedFiles,
            message: `成功上传 ${uploadedFiles.length} 个文件`
        });
        
    } catch (error) {
        console.error('上传文件时出错:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 生成考试的完整流程
router.post('/generate-exam-flow', async (req, res) => {
    try {
        console.log('开始完整的考试生成流程');
        const { title } = req.body;
        
        // 步骤1: 调用Python脚本生成题目
        console.log('步骤1: 调用Python脚本生成题目');
        const quizFilePath = await runPythonScript();
        
        if (!quizFilePath) {
            throw new Error('Python脚本执行失败，未生成题目文件');
        }
        
        // 步骤2: 读取生成的题目文件
        console.log('步骤2: 读取生成的题目文件');
        const quizContent = fs.readFileSync(quizFilePath, 'utf8');
        
        // 步骤3: 解析题目内容
        console.log('步骤3: 解析题目内容');
        const questions = parseQuizContent(quizContent);
        
        if (questions.length === 0) {
            throw new Error('未能解析出有效题目');
        }
        
        // 步骤4: 创建考试并导入数据库
        console.log('步骤4: 创建考试并导入数据库');
        const examId = await createExamFromQuestions(questions, title || '自动生成考试');
        
        // 步骤5: 清理输入文件
        console.log('步骤5: 清理输入文件');
        cleanInputFiles();
        
        res.json({ 
            success: true, 
            examId: examId,
            questionCount: questions.length,
            message: `考试生成成功，包含 ${questions.length} 道题目`
        });
        
    } catch (error) {
        console.error('生成考试流程出错:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 运行Python脚本
async function runPythonScript() {
    const workingDir = path.join(__dirname, '../../voicetotext');
    const quizOutputPath = path.join(workingDir, 'Quiz', 'generated_quiz.txt');
    
    return new Promise((resolve, reject) => {
        console.log('执行Python脚本: python main.py');
        
        const pythonProcess = spawn('python', ['main.py'], {
            cwd: workingDir,
            stdio: 'pipe',
            shell: true
        });
        
        let stdoutData = '';
        let stderrData = '';
        
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString('utf8');
            stdoutData += output;
            console.log(`Python输出: ${output.trim()}`);
        });
        
        pythonProcess.stderr.on('data', (data) => {
            const error = data.toString('utf8');
            stderrData += error;
            console.error(`Python错误: ${error.trim()}`);
        });
        
        pythonProcess.on('close', async (code) => {
            console.log(`Python脚本执行完成，退出码: ${code}`);
            
            if (code !== 0) {
                console.error(`Python脚本执行失败，退出码: ${code}`);
                return reject(new Error(`Python脚本执行失败，退出码: ${code}`));
            }
            
            // 等待文件写入完成
            await new Promise(r => setTimeout(r, 2000));
            
            // 检查生成的题目文件
            if (fs.existsSync(quizOutputPath)) {
                const fileContent = fs.readFileSync(quizOutputPath, 'utf8');
                if (fileContent && fileContent.trim().length > 0) {
                    console.log(`题目文件生成成功，内容长度: ${fileContent.length} 字符`);
                    resolve(quizOutputPath);
                } else {
                    reject(new Error('生成的题目文件为空'));
                }
            } else {
                reject(new Error('未找到生成的题目文件'));
            }
        });
        
        pythonProcess.on('error', (error) => {
            console.error('启动Python脚本时出错:', error);
            reject(error);
        });
        
        // 设置超时
        const timeout = setTimeout(() => {
            pythonProcess.kill();
            reject(new Error('Python脚本执行超时'));
        }, 120000); // 2分钟超时
        
        pythonProcess.on('close', () => {
            clearTimeout(timeout);
        });
    });
}

// 解析题目内容
function parseQuizContent(content) {
    const questions = [];
    const lines = content.split('\n');
    
    let currentQuestionNumber = 0;
    let currentQuestionText = '';
    let currentOptions = [];
    let currentAnswer = '';
    
    // 正则表达式匹配题目编号
    const questionNumberRegex = /^(\d+)[\.、\s]+(.+)$/;
    // 正则表达式匹配选项
    const optionRegex = /^([A-D])[\.\s、]+(.+)$/;
    // 正则表达式匹配答案行
    const answerRegex = /^答案[:：]?\s*([A-D])$/i;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === '') continue;
        
        // 检查是否是题目行
        const questionMatch = questionNumberRegex.exec(line);
        if (questionMatch) {
            // 保存之前的题目
            if (currentOptions.length > 0 && currentAnswer) {
                saveCurrentQuestion();
            }
            
            currentQuestionNumber = parseInt(questionMatch[1]);
            currentQuestionText = questionMatch[2];
            currentOptions = [];
            currentAnswer = '';
            continue;
        }
        
        // 检查是否是选项行
        const optionMatch = optionRegex.exec(line);
        if (optionMatch) {
            const optionLetter = optionMatch[1];
            const optionContent = optionMatch[2];
            
            currentOptions.push({
                letter: optionLetter,
                content: optionContent
            });
            continue;
        }
        
        // 检查是否是答案行
        const answerMatch = answerRegex.exec(line);
        if (answerMatch) {
            currentAnswer = answerMatch[1].toUpperCase();
            continue;
        }
    }
    
    // 保存最后一个题目
    if (currentOptions.length > 0 && currentAnswer) {
        saveCurrentQuestion();
    }
    
    function saveCurrentQuestion() {
        questions.push({
            id: currentQuestionNumber,
            content: currentQuestionText,
            options: currentOptions,
            answer: currentAnswer
        });
        console.log(`解析题目 ${currentQuestionNumber}: ${currentQuestionText.substring(0, 50)}...`);
    }
    
    return questions;
}

// 从题目创建考试
async function createExamFromQuestions(questions, title) {
    let connection;
    
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        // 设置考试开始和结束时间
        const now = new Date();
        const beginDate = now.toISOString().slice(0, 19).replace('T', ' ');
        const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
        
        // 插入考试记录
        const [examResult] = await connection.execute(
            'INSERT INTO th_exam (course_id, author_id, type, title, detail, not_order, begin_date, end_date, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                7, // 默认课程ID
                'stu023', // 默认作者ID
                3, // 默认考试类型
                title,
                '自动生成的考试',
                1,
                beginDate,
                endDate,
                now.toISOString().slice(0, 19).replace('T', ' ')
            ]
        );
        
        const examId = examResult.insertId;
        console.log(`成功创建考试，ID: ${examId}, 标题: ${title}`);
        
        // 处理每个题目
        for (const question of questions) {
            // 使用时间戳+题目编号作为题目ID，避免冲突
            const subjectId = parseInt(`${Date.now().toString().slice(-6)}${question.id}`);
            
            // 检查题目是否已存在
            const [existingSubjects] = await connection.execute(
                'SELECT subject_id FROM th_choice WHERE subject_id = ?',
                [subjectId]
            );
            
            if (existingSubjects.length === 0) {
                // 插入新题目
                await connection.execute(
                    'INSERT INTO th_choice (subject_id, content, answer_num, score) VALUES (?, ?, ?, ?)',
                    [subjectId, question.content, question.options.length, 5]
                );
                
                // 插入选项
                for (let j = 0; j < question.options.length; j++) {
                    const option = question.options[j];
                    const isAnswer = option.letter === question.answer ? 1 : 0;
                    
                    await connection.execute(
                        'INSERT INTO th_choice_option (subject_id, num, content, is_answer) VALUES (?, ?, ?, ?)',
                        [subjectId, j + 1, option.content, isAnswer]
                    );
                }
            }
            
            // 将题目添加到试卷
            await connection.execute(
                'INSERT INTO th_paper (exam_id, subject_type, subject_id, subject_num) VALUES (?, ?, ?, ?)',
                [examId, 1, subjectId, question.id]
            );
        }
        
        await connection.commit();
        console.log(`考试 ${examId} 创建完成，包含 ${questions.length} 道题目`);
        
        return examId;
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

// 清理输入文件
function cleanInputFiles() {
    const inputDir = path.join(__dirname, '../../voicetotext/inputFiles');
    try {
        if (fs.existsSync(inputDir)) {
            const files = fs.readdirSync(inputDir);
            for (const file of files) {
                const filePath = path.join(inputDir, file);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                    console.log(`删除输入文件: ${file}`);
                }
            }
        }
    } catch (error) {
        console.error('清理输入文件失败:', error);
    }
}

module.exports = router;