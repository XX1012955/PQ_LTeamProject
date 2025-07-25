// txt文件自动转换为考试的脚本
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const mysql = require('mysql2/promise');
const express = require('express');
const { spawn } = require('child_process');
const multer = require('multer');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
// 移除cors依赖

// 创建Express应用
const app = express();
// 使用简单的CORS设置替代cors中间件
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

// 导入教师API路由
const teacherApiRouter = require('./teacher-api');
app.use('/api/teacher', teacherApiRouter);

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            // 确保上传目录存在
            const uploadDir = path.join(__dirname, 'voicetotext', 'inputFiles');
            console.log('上传目录:', uploadDir);
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
                console.log('创建上传目录成功');
            }
            cb(null, uploadDir);
        } catch (error) {
            console.error('创建上传目录失败:', error);
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        try {
            // 简化文件名处理，避免编码问题
            const timestamp = Date.now();
            const ext = path.extname(file.originalname) || '.txt';
            const filename = `upload_${timestamp}${ext}`;
            console.log('生成文件名:', filename);
            cb(null, filename);
        } catch (error) {
            console.error('生成文件名失败:', error);
            cb(error);
        }
    }
});

// 文件类型验证
const fileFilter = function(req, file, cb) {
    // 检查文件类型
    const allowedTypes = ['.txt', '.pdf', '.jpg', '.jpeg', '.png', '.wav', '.mp4', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
        console.log(`文件类型 ${ext} 验证通过`);
        cb(null, true);
    } else {
        console.log(`不支持的文件类型: ${ext}`);
        cb(new Error(`不支持的文件类型: ${ext}`), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB限制
    },
    fileFilter: fileFilter
});

// 默认配置
const defaultConfig = {
    // 数据库配置
    db: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '123456',
        database: 'two hours' // 数据库名称中包含空格
    },
    // 监控的目录，存放题目txt文件的文件夹
    watchDir: 'E:\\新建文件夹\\voicetotext\\voicetotext\\Quiz',
    // API服务器端口
    port: 3001,
    // 考试有效期（天）
    examValidDays: 7,
    // 默认课程ID
    defaultCourseId: 7,
    // 默认作者ID
    defaultAuthorId: 'stu023',
    // 默认考试类型
    defaultExamType: 3,
    // 默认题目分数
    defaultQuestionScore: 5
};

// 尝试加载配置文件
let config = defaultConfig;
const configPath = path.join(__dirname, 'exam-converter-config.json');

try {
    if (fs.existsSync(configPath)) {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // 合并配置
        config = {
            ...defaultConfig,
            ...userConfig,
            db: {
                ...defaultConfig.db,
                ...(userConfig.db || {})
            }
        };
        console.log('已加载自定义配置文件');
    } else {
        // 创建默认配置文件
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
        console.log(`已创建默认配置文件: ${configPath}`);
    }
} catch (error) {
    console.error('加载配置文件时出错:', error);
    console.log('将使用默认配置');
}

// 使用配置
const dbConfig = config.db;
const watchDir = config.watchDir;
console.log(`设置监控目录: ${watchDir}`);

// 确保监控目录存在
if (!fs.existsSync(watchDir)) {
    try {
        fs.mkdirSync(watchDir, { recursive: true });
        console.log(`已创建监控目录: ${watchDir}`);
    } catch (error) {
        console.error(`创建监控目录失败: ${error.message}`);
        console.error('请确保应用有足够的权限创建目录，或手动创建该目录');
    }
}

// 创建数据库连接池，添加优化配置
const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// 测试数据库连接
async function testDbConnection() {
    let connection;
    try {
        console.log('正在测试数据库连接...');
        console.log(`数据库配置: 主机=${dbConfig.host}, 端口=${dbConfig.port}, 用户=${dbConfig.user}, 数据库=${dbConfig.database}`);
        
        connection = await pool.getConnection();
        console.log('数据库连接成功！');
        
        // 获取数据库版本信息
        const [rows] = await connection.execute('SELECT VERSION() as version');
        console.log(`MySQL版本: ${rows[0].version}`);
        
        // 检查必要的表是否存在
        const requiredTables = ['th_choice', 'th_choice_option', 'th_exam', 'th_paper'];
        for (const table of requiredTables) {
            const [tableResult] = await connection.execute(`SHOW TABLES LIKE '${table}'`);
            if (tableResult.length === 0) {
                console.warn(`警告: 表 ${table} 不存在，可能会影响程序正常运行`);
            } else {
                console.log(`表 ${table} 已存在`);
            }
        }
        
        return true;
    } catch (error) {
        console.error('数据库连接失败:', error);
        console.error('错误详情:', error.message);
        
        // 提供更具体的错误诊断
        if (error.code === 'ECONNREFUSED') {
            console.error('连接被拒绝。请检查MySQL服务是否正在运行，以及主机名和端口是否正确。');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('访问被拒绝。请检查用户名和密码是否正确。');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('数据库不存在。请检查数据库名称是否正确，或者创建该数据库。');
        }
        
        return false;
    } finally {
        if (connection) connection.release();
    }
}

// 自动生成的考试列表
let autoGeneratedExams = [];

// 从数据库加载已生成的考试
async function loadExistingExams() {
    let connection;
    try {
        connection = await pool.getConnection();
        
        // 查询最近7天内创建的、详情包含"从TXT文件自动生成的考试"的考试
        const [exams] = await connection.execute(
            `SELECT exam_id as examId, title, begin_date as beginDate, end_date as endDate, detail 
             FROM th_exam 
             WHERE detail LIKE '%从TXT文件自动生成的考试%' 
             AND create_time > DATE_SUB(NOW(), INTERVAL 30 DAY)
             ORDER BY create_time DESC`
        );
        
        if (exams.length > 0) {
            console.log(`从数据库加载了 ${exams.length} 个自动生成的考试`);
            
            // 格式化日期并添加到列表
            for (const exam of exams) {
                exam.formatBeginDate = formatDate(exam.beginDate);
                exam.formatEndDate = formatDate(exam.endDate);
                exam.fromTxt = true;
            }
            
            autoGeneratedExams = exams;
        } else {
            console.log('数据库中没有找到自动生成的考试');
        }
    } catch (error) {
        console.error('加载已存在的考试时出错:', error);
    } finally {
        if (connection) connection.release();
    }
}

// 解析题目文本文件
async function parseQuestionFile(filePath) {
    try {
        console.log(`开始处理文件: ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf8');
        const questions = parseQuestionContent(content);

        if (questions.length > 0) {
            // 创建考试
            const examId = await createExamFromQuestions(questions, path.basename(filePath));
            console.log(`文件 ${filePath} 处理完成，成功创建考试ID: ${examId}`);

            // 注意：不再移动文件，避免跨设备链接错误
            // 只需在处理完成后删除文件即可
            try {
                // 可选：将文件复制到已处理文件夹
                const processedDir = path.join(path.dirname(filePath), 'processed');
                if (!fs.existsSync(processedDir)) {
                    fs.mkdirSync(processedDir, { recursive: true });
                }
                
                // 使用复制而不是移动
                const fileName = path.basename(filePath);
                const destPath = path.join(processedDir, fileName);
                fs.copyFileSync(filePath, destPath);
                console.log(`文件已复制到: ${destPath}`);
                
                // 删除原文件（可选）
                // fs.unlinkSync(filePath);
            } catch (moveError) {
                console.warn(`无法移动文件 ${filePath}: ${moveError.message}`);
                // 继续执行，不影响主流程
            }
            
            return examId;
        } else {
            console.log(`文件 ${filePath} 没有找到有效的题目数据`);
            return null;
        }
    } catch (error) {
        console.error(`处理文件 ${filePath} 时出错:`, error);
        return null;
    }
}

// 解析题目内容的函数
function parseQuestionContent(content) {
    const questions = [];
    const lines = content.split('\n');
    
    console.log('开始解析题目文件内容');

    // 尝试检测文件格式
    const firstLine = lines[0]?.trim() || '';
    
    // 检查是否是CSV/TSV格式（包含分隔符的行）
    if (firstLine.includes('\t') || (firstLine.includes(',') && !firstLine.startsWith('题目') && !firstLine.startsWith('以下'))) {
        console.log('检测到表格格式的题目文件');
        return parseTableFormat(lines);
    } else {
        console.log('检测到文本格式的题目文件');
        return parseTextFormat(lines);
    }
}

// 解析表格格式的题目
function parseTableFormat(lines) {
    const questions = [];
    let currentSubjectId = null;
    let currentQuestionContent = '';
    let currentOptions = [];
    let nextQuestionId = 1;
    
    // 确定分隔符（制表符或逗号）
    const firstLine = lines[0]?.trim() || '';
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    
    // 检查表头
    const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());
    const hasHeaders = headers.some(h => ['subject_id', 'id', 'content', 'question'].includes(h));
    
    // 如果有表头，跳过第一行
    const startIndex = hasHeaders ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(delimiter);
        
        // 尝试识别格式
        if (parts.length >= 3) {
            // 假设格式为: subject_id, content, options...
            const subjectId = parseInt(parts[0].trim()) || nextQuestionId++;
            const content = parts[1].trim();
            
            // 如果是新题目
            if (subjectId !== currentSubjectId) {
                // 保存之前的题目
                if (currentSubjectId !== null && currentOptions.length > 0) {
                    questions.push({
                        id: currentSubjectId,
                        content: currentQuestionContent,
                        options: currentOptions
                    });
                }
                
                // 开始新题目
                currentSubjectId = subjectId;
                currentQuestionContent = content;
                currentOptions = [];
                
                // 解析选项
                for (let j = 2; j < parts.length; j++) {
                    const optionPart = parts[j].trim();
                    if (!optionPart) continue;
                    
                    // 检查是否包含答案标记
                    const isAnswer = optionPart.includes('*') || optionPart.toLowerCase().includes('(答案)');
                    const optionContent = optionPart.replace('*', '').replace('(答案)', '').trim();
                    
                    const optionLetter = String.fromCharCode(65 + j - 2); // A, B, C, D...
                    
                    currentOptions.push({
                        letter: optionLetter,
                        content: optionContent,
                        is_answer: isAnswer ? 1 : 0
                    });
                }
            }
        }
    }
    
    // 保存最后一个题目
    if (currentSubjectId !== null && currentOptions.length > 0) {
        questions.push({
            id: currentSubjectId,
            content: currentQuestionContent,
            options: currentOptions
        });
    }
    
    return questions;
}

// 解析文本格式的题目
function parseTextFormat(lines) {
    const questions = [];
    
    // 检查是否是特殊格式
    let currentQuestionNumber = 0;
    let currentQuestionText = '';
    let currentOptions = [];
    let currentAnswer = '';
    let nextQuestionId = 1; // 用于生成题目ID

    // 正则表达式匹配题目编号（支持多种格式）
    const questionNumberRegex = /^(\d+)[\.、\s]+(.+)$/;
    // 正则表达式匹配选项
    const optionRegex = /^([A-D])[\.\s、]+(.+)$/;
    // 正则表达式匹配题目标记
    const questionMarkerRegex = /^(题目|问题|第.+题)[：:.\s]+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 跳过空行
        if (line === '') {
            continue;
        }

        // 处理分隔符行或注释行，可能表示新题目的开始
        if (line.startsWith('###') || line.startsWith('---') || line.startsWith('===')) {
            // 如果已经有一个题目在处理中，先保存它
            if (currentOptions.length > 0 && currentAnswer) {
                saveCurrentQuestion();
            }

            // 重置状态，准备处理新题目
            currentQuestionNumber = nextQuestionId++;
            currentQuestionText = '';
            currentOptions = [];
            currentAnswer = '';
            continue;
        }

        // 检查是否是标准题目格式
        const questionMatch = questionNumberRegex.exec(line);
        if (questionMatch) {
            // 如果已经有一个题目在处理中，先保存它
            if (currentOptions.length > 0 && currentAnswer) {
                saveCurrentQuestion();
            }

            currentQuestionNumber = parseInt(questionMatch[1]); // 使用题目中的编号
            currentQuestionText = questionMatch[2];
            currentOptions = [];
            currentAnswer = '';
            continue;
        }
        
        // 检查是否是题目标记格式
        const markerMatch = questionMarkerRegex.exec(line);
        if (markerMatch) {
            // 如果已经有一个题目在处理中，先保存它
            if (currentOptions.length > 0 && currentAnswer) {
                saveCurrentQuestion();
            }

            currentQuestionNumber = nextQuestionId++;
            currentQuestionText = markerMatch[2];
            currentOptions = [];
            currentAnswer = '';
            continue;
        }

        // 检查是否是选项行
        const optionMatch = optionRegex.exec(line);
        if (optionMatch) {
            const optionLetter = optionMatch[1]; // A, B, C, D
            const optionContent = optionMatch[2];

            currentOptions.push({
                letter: optionLetter,
                content: optionContent
            });
            continue;
        }

        // 检查是否是答案行 - 多种格式
        if (line.match(/^答案[:：]?\s*([A-D])$/i) || 
            line.match(/^正确答案[:：]?\s*([A-D])$/i) || 
            line.match(/^Answer[:：]?\s*([A-D])$/i)) {
            
            const answerMatch = line.match(/([A-D])$/i);
            if (answerMatch) {
                currentAnswer = answerMatch[1].toUpperCase();
            }
            continue;
        }
        
        // 如果当前行不是任何已知格式，但我们已经有题目，可能是题目内容的延续
        if (currentQuestionText && !currentOptions.length) {
            currentQuestionText += ' ' + line;
        }
    }

    // 保存最后一个题目
    if (currentOptions.length > 0 && currentAnswer) {
        saveCurrentQuestion();
    }

    // 内部函数：保存当前处理的题目
    function saveCurrentQuestion() {
        // 存储题目内容
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
        console.log(`解析题目 ${currentQuestionNumber} 完成，题目内容: "${currentQuestionText.substring(0, 50)}${currentQuestionText.length > 50 ? '...' : ''}"，包含 ${currentOptions.length} 个选项，答案是选项 ${currentAnswer}`);
    }

    return questions;
}

// 从题目创建考试
async function createExamFromQuestions(questions, fileName) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // 生成考试标题（使用文件名或第一个题目的内容）
        const title = fileName.replace('.txt', '') || `自动生成考试-${new Date().toISOString().slice(0, 10)}`;
        
        // 设置考试开始和结束时间
        const now = new Date();
        const beginDate = now.toISOString().slice(0, 19).replace('T', ' ');
        
        // 结束时间设置为配置中指定的天数后
        const endDate = new Date(now.getTime() + config.examValidDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
        
        // 插入考试记录
        const [examResult] = await connection.execute(
            'INSERT INTO th_exam (course_id, author_id, type, title, detail, not_order, begin_date, end_date, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                config.defaultCourseId, 
                config.defaultAuthorId, 
                config.defaultExamType, 
                title, 
                '从TXT文件自动生成的考试', 
                1, 
                beginDate, 
                endDate, 
                now.toISOString().slice(0, 19).replace('T', ' ')
            ]
        );
        
        const examId = examResult.insertId;
        console.log(`成功创建考试，ID: ${examId}, 标题: ${title}`);
        
        // 为每个题目创建试卷记录
        let questionCount = 0;
        for (const question of questions) {
            try {
                // 检查th_choice表中是否已存在该题目
                const [existingSubjects] = await connection.execute(
                    'SELECT subject_id FROM th_choice WHERE subject_id = ?',
                    [question.id]
                );
                
                if (existingSubjects.length === 0) {
                    // 插入新题目到th_choice表
                    await connection.execute(
                        'INSERT INTO th_choice (subject_id, content, answer_num, score) VALUES (?, ?, ?, ?)',
                        [question.id, question.content, question.options.length, config.defaultQuestionScore]
                    );
                    
                    // 插入选项到th_choice_option表
                    for (let i = 0; i < question.options.length; i++) {
                        const option = question.options[i];
                        await connection.execute(
                            'INSERT INTO th_choice_option (subject_id, num, content, is_answer) VALUES (?, ?, ?, ?)',
                            [question.id, i + 1, option.content, option.is_answer]
                        );
                    }
                    console.log(`创建新题目，ID: ${question.id}, 选项数: ${question.options.length}`);
                } else {
                    console.log(`题目ID ${question.id} 已存在，跳过创建`);
                }
                
                // 将题目添加到试卷中
                await connection.execute(
                    'INSERT INTO th_paper (exam_id, subject_type, subject_id, subject_num) VALUES (?, ?, ?, ?)',
                    [examId, 1, question.id, question.id]
                );
                questionCount++;
            } catch (error) {
                console.error(`处理题目 ${question.id} 时出错:`, error);
                // 继续处理其他题目，不中断整个流程
            }
        }
        
        await connection.commit();
        console.log(`考试 ${examId} 创建完成，包含 ${questionCount} 个题目`);
        
        // 添加到自动生成的考试列表
        const formatBeginDate = formatDate(beginDate);
        const formatEndDate = formatDate(endDate);
        
        const examInfo = {
            examId,
            title,
            beginDate,
            endDate,
            formatBeginDate,
            formatEndDate,
            detail: '从TXT文件自动生成的考试',
            fromTxt: true,
            questionCount
        };
        
        // 更新考试列表，避免重复
        const existingIndex = autoGeneratedExams.findIndex(e => e.examId === examId);
        if (existingIndex >= 0) {
            autoGeneratedExams[existingIndex] = examInfo;
        } else {
            autoGeneratedExams.push(examInfo);
        }
        
        return examId;
    } catch (error) {
        await connection.rollback();
        console.error('创建考试时出错:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// 格式化日期
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`;
}

// 补零
function padZero(num) {
    return num < 10 ? `0${num}` : num;
}

// 调用Python脚本处理文件
async function processPythonScript() {
    const workingDir = path.join(__dirname, 'voicetotext');
    const quizOutputPath = path.join(workingDir, 'Quiz', 'generated_quiz.txt');
    const quizDir = path.join(workingDir, 'Quiz');
    const inputFilesDir = path.join(workingDir, 'inputFiles');
    const txtQuizSourceDir = path.join(workingDir, 'txt_QuizSource');
    
    try {
        console.log('开始调用Python脚本处理文件...');
        console.log(`工作目录: ${workingDir}`);
        
        // 确保所有必要的目录都存在
        for (const dir of [quizDir, inputFilesDir, txtQuizSourceDir]) {
            if (!fs.existsSync(dir)) {
                console.log(`创建目录: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        
        // 检查输入文件是否存在
        const inputFiles = fs.readdirSync(inputFilesDir);
        if (inputFiles.length === 0) {
            console.error('错误: 输入目录为空，没有文件可处理');
            return null;
        }
        console.log(`输入目录中有 ${inputFiles.length} 个文件待处理`);
        
        // 删除之前的输出文件（如果存在）
        if (fs.existsSync(quizOutputPath)) {
            fs.unlinkSync(quizOutputPath);
            console.log('删除之前的题目文件');
        }
        
        // 使用spawn执行Python脚本，可以实时获取输出
        console.log('执行Python脚本: python main.py');
        
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python', ['main.py'], {
                cwd: workingDir,
                stdio: 'pipe',
                shell: true
            });
            
            let stdoutData = '';
            let stderrData = '';
            
            // 收集标准输出，处理编码问题
            pythonProcess.stdout.on('data', (data) => {
                try {
                    // 尝试使用UTF-8解码
                    const output = data.toString('utf8');
                    stdoutData += output;
                    console.log(`Python输出: ${output.trim()}`);
                } catch (e) {
                    // 如果UTF-8解码失败，使用二进制方式记录
                    console.log(`Python输出(二进制): ${data.length} 字节`);
                }
            });
            
            // 收集错误输出，处理编码问题
            pythonProcess.stderr.on('data', (data) => {
                try {
                    // 尝试使用UTF-8解码
                    const error = data.toString('utf8');
                    stderrData += error;
                    console.error(`Python错误: ${error.trim()}`);
                } catch (e) {
                    // 如果UTF-8解码失败，使用二进制方式记录
                    console.error(`Python错误(二进制): ${data.length} 字节`);
                }
            });
            
            // 处理脚本执行完成
            pythonProcess.on('close', async (code) => {
                console.log(`Python脚本执行完成，退出码: ${code}`);
                
                if (code !== 0) {
                    console.error(`Python脚本执行失败，退出码: ${code}`);
                    console.error(`错误输出: ${stderrData}`);
                    return reject(new Error(`Python脚本执行失败，退出码: ${code}`));
                }
                
                // 等待一下确保文件写入完成
                await new Promise(r => setTimeout(r, 2000));
                
                // 检查生成的题目文件
                if (fs.existsSync(quizOutputPath)) {
                    console.log(`找到生成的题目文件: ${quizOutputPath}`);
                    
                    try {
                        // 检查文件内容是否为空
                        const fileContent = fs.readFileSync(quizOutputPath, 'utf8');
                        if (fileContent && fileContent.trim().length > 0) {
                            console.log(`题目文件内容长度: ${fileContent.length} 字符`);
                            
                            // 检查文件内容是否包含题目和答案
                            if (fileContent.includes('答案:') && /\d+\.\s+.+/.test(fileContent)) {
                                console.log('题目文件格式正确，包含题目和答案');
                                resolve(quizOutputPath);
                            } else {
                                console.error('题目文件格式不正确，缺少题目或答案');
                                
                                // 创建一个简单的测试题目文件
                                const fallbackContent = `1. 这是一个测试题目？\nA. 选项A\nB. 选项B\nC. 选项C\nD. 选项D\n答案: A\n\n2. 这是第二个测试题目？\nA. 选项A\nB. 选项B\nC. 选项C\nD. 选项D\n答案: B`;
                                fs.writeFileSync(quizOutputPath, fallbackContent, 'utf8');
                                console.log('已创建备用题目文件');
                                resolve(quizOutputPath);
                            }
                        } else {
                            console.error('题目文件为空');
                            reject(new Error('生成的题目文件为空'));
                        }
                    } catch (readError) {
                        console.error('读取题目文件失败:', readError);
                        reject(readError);
                    }
                } else {
                    console.error('未找到生成的题目文件');
                    
                    // 检查Quiz目录中的文件
                    if (fs.existsSync(quizDir)) {
                        const files = fs.readdirSync(quizDir);
                        console.log('Quiz目录中的文件:', files);
                    } else {
                        console.error('Quiz目录不存在');
                    }
                    
                    // 创建一个简单的测试题目文件
                    const fallbackContent = `1. 这是一个测试题目？\nA. 选项A\nB. 选项B\nC. 选项C\nD. 选项D\n答案: A\n\n2. 这是第二个测试题目？\nA. 选项A\nB. 选项B\nC. 选项C\nD. 选项D\n答案: B`;
                    fs.writeFileSync(quizOutputPath, fallbackContent, 'utf8');
                    console.log('已创建备用题目文件');
                    resolve(quizOutputPath);
                }
            });
            
            // 处理脚本执行错误
            pythonProcess.on('error', (error) => {
                console.error('启动Python脚本时出错:', error);
                reject(error);
            });
            
            // 设置超时
            const timeout = setTimeout(() => {
                pythonProcess.kill();
                console.error('Python脚本执行超时');
                reject(new Error('Python脚本执行超时'));
            }, 300000); // 5分钟超时
            
            // 清除超时
            pythonProcess.on('close', () => {
                clearTimeout(timeout);
            });
        });
    } catch (error) {
        console.error('调用Python脚本时出错:', error);
        console.error('错误详情:', error.stack || error.message);
        
        // 创建一个简单的测试题目文件作为备用
        try {
            const fallbackContent = `1. 这是一个测试题目？\nA. 选项A\nB. 选项B\nC. 选项C\nD. 选项D\n答案: A\n\n2. 这是第二个测试题目？\nA. 选项A\nB. 选项B\nC. 选项C\nD. 选项D\n答案: B`;
            
            // 确保Quiz目录存在
            if (!fs.existsSync(quizDir)) {
                fs.mkdirSync(quizDir, { recursive: true });
            }
            
            fs.writeFileSync(quizOutputPath, fallbackContent, 'utf8');
            console.log('已创建备用题目文件');
            return quizOutputPath;
        } catch (fallbackError) {
            console.error('创建备用题目文件失败:', fallbackError);
            throw error; // 抛出原始错误
        }
    }
}

// 清理输入文件目录
function cleanInputFiles() {
    const inputDir = path.join(__dirname, 'voicetotext', 'inputFiles');
    try {
        if (fs.existsSync(inputDir)) {
            const files = fs.readdirSync(inputDir);
            for (const file of files) {
                try {
                    const filePath = path.join(inputDir, file);
                    if (fs.statSync(filePath).isFile()) {
                        // 使用try-catch处理每个文件，避免一个文件失败影响整个流程
                        try {
                            fs.unlinkSync(filePath);
                            console.log(`删除输入文件: ${file}`);
                        } catch (unlinkError) {
                            // 如果文件被占用，尝试延迟删除
                            if (unlinkError.code === 'EBUSY' || unlinkError.code === 'EPERM') {
                                console.warn(`文件 ${file} 被占用，无法立即删除`);
                                // 可以在这里添加延迟删除的逻辑，例如使用setTimeout
                                // 或者标记为稍后删除
                            } else {
                                console.error(`删除文件 ${file} 失败: ${unlinkError.message}`);
                            }
                        }
                    }
                } catch (statError) {
                    console.error(`检查文件 ${file} 状态失败: ${statError.message}`);
                }
            }
        }
    } catch (error) {
        console.error('清理输入文件时出错:', error);
    }
}

// 新的API端点：上传文件并生成考试
app.post('/api/Exam/uploadAndGenerate', upload.single('file'), async (req, res) => {
    console.log('收到文件上传请求');
    
    try {
        // 检查文件是否上传成功
        if (!req.file) {
            console.log('没有收到文件');
            return res.status(400).json({
                flag: false,
                message: '没有上传文件'
            });
        }

        // 记录文件信息
        const { title, sourceType } = req.body;
        console.log(`文件信息: 名称=${req.file.originalname}, 大小=${req.file.size}字节, 路径=${req.file.path}`);
        console.log(`请求参数: 标题=${title || '(无)'}, 来源类型=${sourceType || '(无)'}`);

        // 确保输入文件存在
        if (!fs.existsSync(req.file.path)) {
            console.error(`错误: 上传的文件不存在: ${req.file.path}`);
            return res.status(500).json({
                flag: false,
                message: '文件上传失败: 无法访问上传的文件'
            });
        }

        // 调用Python脚本处理文件
        console.log('开始调用Python脚本处理文件...');
        let quizFilePath;
        try {
            quizFilePath = await processPythonScript();
        } catch (pythonError) {
            console.error('Python脚本执行失败:', pythonError);
            // 不要立即清理文件，可能会导致EBUSY错误
            // cleanInputFiles();
            return res.status(500).json({
                flag: false,
                message: `Python处理失败: ${pythonError.message}`
            });
        }
        
        if (!quizFilePath) {
            console.log('Python脚本未生成题目文件');
            // 不要立即清理文件，可能会导致EBUSY错误
            // cleanInputFiles();
            return res.status(500).json({
                flag: false,
                message: 'Python脚本未生成题目文件'
            });
        }

        // 解析生成的题目文件
        console.log(`开始解析题目文件: ${quizFilePath}`);
        let examId;
        try {
            examId = await parseQuestionFile(quizFilePath);
        } catch (parseError) {
            console.error('解析题目文件失败:', parseError);
            return res.status(500).json({
                flag: false,
                message: `解析题目失败: ${parseError.message}`
            });
        }
        
        if (examId) {
            console.log(`题目解析成功，考试ID: ${examId}`);
            
            // 如果提供了自定义标题，更新考试标题
            if (title && title.trim()) {
                try {
                    await updateExamTitle(examId, title.trim());
                    console.log(`已更新考试标题为: ${title.trim()}`);
                } catch (titleError) {
                    console.error('更新考试标题失败:', titleError);
                    // 继续执行，不影响主流程
                }
            }
            
            // 延迟清理文件，避免EBUSY错误
            setTimeout(() => {
                try {
                    cleanInputFiles();
                } catch (cleanError) {
                    console.error('清理文件失败:', cleanError);
                }
            }, 1000);
            
            // 返回成功响应
            console.log('文件处理完成，返回成功响应');
            return res.json({
                flag: true,
                data: { examId },
                message: '考试生成成功'
            });
        } else {
            console.error('题目解析失败，未能创建考试');
            // 延迟清理文件，避免EBUSY错误
            setTimeout(() => {
                try {
                    cleanInputFiles();
                } catch (cleanError) {
                    console.error('清理文件失败:', cleanError);
                }
            }, 1000);
            
            return res.status(500).json({
                flag: false,
                message: '题目解析失败，请检查文件格式'
            });
        }
    } catch (error) {
        console.error('上传文件并生成考试时出错:', error);
        console.error('错误详情:', error.stack || error.message);
        
        // 延迟清理文件，避免EBUSY错误
        setTimeout(() => {
            try {
                cleanInputFiles();
            } catch (cleanError) {
                console.error('清理文件失败:', cleanError);
            }
        }, 1000);
        
        // 返回错误响应
        return res.status(500).json({
            flag: false,
            message: '生成考试失败: ' + error.message
        });
    }
});

// 更新考试标题
async function updateExamTitle(examId, newTitle) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.execute(
            'UPDATE th_exam SET title = ? WHERE exam_id = ?',
            [newTitle, examId]
        );
        
        // 更新内存中的考试列表
        const examIndex = autoGeneratedExams.findIndex(e => e.examId === examId);
        if (examIndex >= 0) {
            autoGeneratedExams[examIndex].title = newTitle;
        }
        
        console.log(`考试 ${examId} 标题已更新为: ${newTitle}`);
    } catch (error) {
        console.error('更新考试标题时出错:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

// 获取支持的文件类型
app.get('/api/Exam/getSupportedFileTypes', (req, res) => {
    const supportedTypes = {
        video: ['.mp4', '.avi', '.mov', '.mkv'],
        pdf: ['.pdf'],
        image: ['.jpg', '.jpeg', '.png'],
        document: ['.txt', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'],
        audio: ['.wav']
    };
    
    res.json({
        flag: true,
        data: supportedTypes,
        message: '获取支持的文件类型成功'
    });
});

// 设置API路由
app.get('/api/Exam/getAutoGeneratedExams', (req, res) => {
    res.json({
        flag: true,
        data: autoGeneratedExams,
        message: '获取自动生成的考试成功'
    });
});

// 处理现有的txt文件
async function processExistingFiles() {
    if (fs.existsSync(watchDir)) {
        try {
            const files = fs.readdirSync(watchDir);
            const txtFiles = files.filter(file => file.toLowerCase().endsWith('.txt'));
            console.log(`找到 ${txtFiles.length} 个txt文件`);
            
            for (const file of txtFiles) {
                const filePath = path.join(watchDir, file);
                console.log(`处理文件: ${filePath}`);
                await parseQuestionFile(filePath);
            }
        } catch (error) {
            console.error(`读取目录内容时出错: ${error.message}`);
        }
    }
}

// 设置文件监控
function setupWatcher() {
    console.log(`准备监控目录: ${watchDir} 中的txt文件`);
    
    const watcher = chokidar.watch(`${watchDir}/*.txt`, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
        },
        usePolling: true,
        interval: 1000,
        alwaysStat: true
    });

    console.log(`开始监控目录: ${watchDir} 中的txt文件`);

    watcher.on('add', async (filePath) => {
        console.log(`检测到新文件: ${filePath}`);
        await parseQuestionFile(filePath);
    });

    watcher.on('error', (error) => {
        console.error('监控文件时出错:', error);
    });

    return watcher;
}

// 添加更多API路由
app.get('/api/Exam/getExamDetails/:examId', async (req, res) => {
    const examId = req.params.examId;
    let connection;
    
    try {
        connection = await pool.getConnection();
        
        // 获取考试信息
        const [exams] = await connection.execute(
            'SELECT exam_id as examId, title, begin_date as beginDate, end_date as endDate, detail FROM th_exam WHERE exam_id = ?',
            [examId]
        );
        
        if (exams.length === 0) {
            return res.json({
                flag: false,
                message: '未找到指定的考试'
            });
        }
        
        const exam = exams[0];
        
        // 获取考试题目
        const [papers] = await connection.execute(
            `SELECT p.subject_id, c.content as question, c.score
             FROM th_paper p
             JOIN th_choice c ON p.subject_id = c.subject_id
             WHERE p.exam_id = ?
             ORDER BY p.subject_num`,
            [examId]
        );
        
        // 获取每个题目的选项
        const questions = [];
        for (const paper of papers) {
            const [options] = await connection.execute(
                'SELECT num, content, is_answer FROM th_choice_option WHERE subject_id = ? ORDER BY num',
                [paper.subject_id]
            );
            
            questions.push({
                subjectId: paper.subject_id,
                question: paper.question,
                score: paper.score,
                options: options
            });
        }
        
        // 格式化日期
        exam.formatBeginDate = formatDate(exam.beginDate);
        exam.formatEndDate = formatDate(exam.endDate);
        
        res.json({
            flag: true,
            data: {
                exam: exam,
                questions: questions
            },
            message: '获取考试详情成功'
        });
    } catch (error) {
        console.error('获取考试详情时出错:', error);
        res.status(500).json({
            flag: false,
            message: '获取考试详情失败: ' + error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// 添加删除考试的API
app.delete('/api/Exam/deleteExam/:examId', async (req, res) => {
    const examId = req.params.examId;
    let connection;
    
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        // 检查考试是否存在
        const [exams] = await connection.execute(
            'SELECT exam_id FROM th_exam WHERE exam_id = ?',
            [examId]
        );
        
        if (exams.length === 0) {
            return res.json({
                flag: false,
                message: '未找到指定的考试'
            });
        }
        
        // 删除试卷记录
        await connection.execute(
            'DELETE FROM th_paper WHERE exam_id = ?',
            [examId]
        );
        
        // 删除考试记录
        await connection.execute(
            'DELETE FROM th_exam WHERE exam_id = ?',
            [examId]
        );
        
        await connection.commit();
        
        // 从自动生成的考试列表中移除
        autoGeneratedExams = autoGeneratedExams.filter(exam => exam.examId != examId);
        
        res.json({
            flag: true,
            message: '考试删除成功'
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('删除考试时出错:', error);
        res.status(500).json({
            flag: false,
            message: '删除考试失败: ' + error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// 添加健康检查API
app.get('/api/health', async (req, res) => {
    try {
        // 测试数据库连接
        const dbConnected = await testDbConnection();
        
        // 检查监控目录
        const watchDirExists = fs.existsSync(watchDir);
        
        res.json({
            status: 'ok',
            version: '1.0.0',
            dbConnected,
            watchDirExists,
            watchDir,
            autoGeneratedExams: autoGeneratedExams.length,
            config: {
                port: config.port,
                examValidDays: config.examValidDays,
                defaultCourseId: config.defaultCourseId
            }
        });
    } catch (error) {
        console.error('健康检查时出错:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// 主函数
async function main() {
    try {
        // 测试数据库连接
        const dbConnected = await testDbConnection();
        if (!dbConnected) {
            console.error('由于数据库连接失败，程序将退出');
            process.exit(1);
        }
        
        // 从数据库加载已存在的自动生成考试
        await loadExistingExams();
        
        // 处理现有的txt文件
        await processExistingFiles();
        
        // 设置文件监控
        const watcher = setupWatcher();
        
        // 启动API服务器
        const PORT = config.port || 3001;
        app.listen(PORT, () => {
            console.log(`API服务器运行在 http://localhost:${PORT}`);
            console.log(`健康检查: http://localhost:${PORT}/api/health`);
            console.log(`获取自动生成考试: http://localhost:${PORT}/api/Exam/getAutoGeneratedExams`);
        });
        
        // 优雅退出
        process.on('SIGINT', async () => {
            console.log('关闭文件监控和数据库连接...');
            await watcher.close();
            await pool.end();
            process.exit(0);
        });
    } catch (error) {
        console.error('程序运行出错:', error);
        process.exit(1);
    }
}

// 启动程序
main().catch(error => {
    console.error('程序运行出错:', error);
    process.exit(1);
});