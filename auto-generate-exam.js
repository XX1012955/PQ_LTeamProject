// 自动生成考试脚本
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');

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

// 配置
const inputFile = process.argv[2]; // 从命令行参数获取输入文件
const scriptDir = __dirname;
const voicetotextDir = path.join(scriptDir, 'voicetotext');
const inputFilesDir = path.join(voicetotextDir, 'inputFiles');
const quizOutputFile = path.join(voicetotextDir, 'Quiz', 'generated_quiz.txt');

// 复制输入文件到处理目录
function copyInputFile() {
    if (!inputFile) {
        console.log('没有指定输入文件，跳过复制步骤');
        return null;
    }
    
    // 确保目录存在
    if (!fs.existsSync(inputFilesDir)) {
        fs.mkdirSync(inputFilesDir, { recursive: true });
    }
    
    const targetPath = path.join(inputFilesDir, path.basename(inputFile));
    
    // 复制文件
    fs.copyFileSync(inputFile, targetPath);
    console.log(`已复制文件 ${inputFile} 到 ${targetPath}`);
    
    return targetPath;
}

// 运行Python脚本生成题目
function runPythonScript() {
    return new Promise((resolve, reject) => {
        console.log('运行Python脚本生成题目...');
        
        const pythonScript = path.join(voicetotextDir, 'main.py');
        const pythonProcess = spawn('python', [pythonScript]);
        
        pythonProcess.stdout.on('data', (data) => {
            console.log(`Python输出: ${data}`);
        });
        
        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python错误: ${data}`);
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log('Python脚本执行成功');
                resolve();
            } else {
                reject(new Error(`Python脚本执行失败，退出码: ${code}`));
            }
        });
    });
}

// 解析题目内容
function parseQuizContent(content) {
    const questions = [];
    const lines = content.split('\n');
    
    console.log('开始解析题目文件内容');
    console.log(`总行数: ${lines.length}`);
    
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
        
        // 跳过空行
        if (line === '') {
            continue;
        }
        
        // 检查是否是题目行
        const questionMatch = questionNumberRegex.exec(line);
        if (questionMatch) {
            // 如果已经有一个题目在处理中，先保存它
            if (currentOptions.length > 0 && currentAnswer) {
                saveCurrentQuestion();
            }
            
            currentQuestionNumber = parseInt(questionMatch[1]);
            currentQuestionText = questionMatch[2];
            currentOptions = [];
            currentAnswer = '';
            console.log(`识别为题目 ${currentQuestionNumber}: ${currentQuestionText}`);
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
            console.log(`识别为选项 ${optionLetter}: ${optionContent}`);
            continue;
        }
        
        // 检查是否是答案行
        const answerMatch = answerRegex.exec(line);
        if (answerMatch) {
            currentAnswer = answerMatch[1].toUpperCase();
            console.log(`识别为答案: ${currentAnswer}`);
            continue;
        }
    }
    
    // 保存最后一个题目
    if (currentOptions.length > 0 && currentAnswer) {
        saveCurrentQuestion();
    }
    
    // 内部函数：保存当前处理的题目
    function saveCurrentQuestion() {
        // 创建题目对象
        const questionData = {
            id: currentQuestionNumber,
            content: currentQuestionText,
            options: []
        };
        
        for (let j = 0; j < currentOptions.length; j++) {
            const option = currentOptions[j];
            const isAnswer = option.letter === currentAnswer ? 1 : 0;
            
            // 将选项添加到题目数据中
            questionData.options.push({
                letter: option.letter,
                content: option.content,
                is_answer: isAnswer
            });
        }
        
        questions.push(questionData);
        console.log(`解析题目 ${currentQuestionNumber} 完成，题目内容: "${currentQuestionText}"，包含 ${currentOptions.length} 个选项，答案是选项 ${currentAnswer}`);
    }
    
    return questions;
}

// 创建考试
async function createExam(questions) {
    let connection;
    
    try {
        console.log('连接数据库...');
        connection = await pool.getConnection();
        console.log('数据库连接成功');
        
        await connection.beginTransaction();
        console.log('开始事务');
        
        // 生成考试标题
        const title = '计算机科学测试 - ' + new Date().toISOString().slice(0, 10);
        
        // 设置考试开始和结束时间
        const now = new Date();
        const beginDate = now.toISOString().slice(0, 19).replace('T', ' ');
        
        // 结束时间设置为7天后
        const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
        
        // 插入考试记录
        console.log('创建考试记录...');
        const [examResult] = await connection.execute(
            'INSERT INTO th_exam (course_id, author_id, type, title, detail, not_order, begin_date, end_date, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                7, // 默认课程ID
                'stu023', // 默认作者ID
                3, // 默认考试类型
                title,
                '自动生成的计算机科学测试',
                1,
                beginDate,
                endDate,
                now.toISOString().slice(0, 19).replace('T', ' ')
            ]
        );
        
        const examId = examResult.insertId;
        console.log(`成功创建考试，ID: ${examId}, 标题: ${title}`);
        
        // 处理所有题目
        for (const question of questions) {
            // 检查th_choice表中是否已存在该题目
            console.log(`检查题目ID ${question.id} 是否存在...`);
            const [existingSubjects] = await connection.execute(
                'SELECT subject_id FROM th_choice WHERE subject_id = ?',
                [question.id]
            );
            
            if (existingSubjects.length === 0) {
                // 插入新题目到th_choice表
                console.log(`创建新题目，ID: ${question.id}`);
                await connection.execute(
                    'INSERT INTO th_choice (subject_id, content, answer_num, score) VALUES (?, ?, ?, ?)',
                    [question.id, question.content, question.options.length, 5]
                );
                
                // 插入选项到th_choice_option表
                console.log('创建题目选项...');
                for (let i = 0; i < question.options.length; i++) {
                    const option = question.options[i];
                    await connection.execute(
                        'INSERT INTO th_choice_option (subject_id, num, content, is_answer) VALUES (?, ?, ?, ?)',
                        [question.id, i + 1, option.content, option.is_answer]
                    );
                    console.log(`  选项 ${option.letter}: ${option.content}, 是否正确: ${option.is_answer}`);
                }
            } else {
                console.log(`题目ID ${question.id} 已存在，跳过创建`);
            }
            
            // 将题目添加到试卷中
            console.log('将题目添加到试卷...');
            await connection.execute(
                'INSERT INTO th_paper (exam_id, subject_type, subject_id, subject_num) VALUES (?, ?, ?, ?)',
                [examId, 1, question.id, question.id]
            );
        }
        
        await connection.commit();
        console.log(`考试 ${examId} 创建完成，包含 ${questions.length} 道题目`);
        
        return examId;
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('创建考试时出错:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

// 主函数
async function main() {
    try {
        console.log('开始自动生成考试流程...');
        
        // 步骤1：复制输入文件到处理目录
        copyInputFile();
        
        // 步骤2：运行Python脚本生成题目
        await runPythonScript();
        
        // 步骤3：读取生成的题目文件
        console.log(`读取题目文件: ${quizOutputFile}`);
        
        if (!fs.existsSync(quizOutputFile)) {
            console.error(`错误: 题目文件不存在: ${quizOutputFile}`);
            process.exit(1);
        }
        
        const quizContent = fs.readFileSync(quizOutputFile, 'utf8');
        console.log(`读取题目文件成功，内容长度: ${quizContent.length} 字符`);
        
        // 步骤4：解析题目
        const questions = parseQuizContent(quizContent);
        console.log(`解析出 ${questions.length} 道题目`);
        
        // 步骤5：创建考试
        const examId = await createExam(questions);
        console.log(`考试创建成功，ID: ${examId}`);
        
        console.log('自动生成考试流程完成！');
        console.log(`考试ID: ${examId}`);
        console.log(`考试预览URL: http://localhost:8080/#/Management/ExamPreview/${examId}`);
        
        // 关闭连接池
        await pool.end();
    } catch (error) {
        console.error('程序运行出错:', error);
        process.exit(1);
    }
}

// 执行主函数
main().catch(error => {
    console.error('程序运行出错:', error);
    process.exit(1);
});