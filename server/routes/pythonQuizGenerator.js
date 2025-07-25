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

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 保存到voicetotext/inputFiles目录
    const uploadDir = path.join(__dirname, '../../voicetotext/inputFiles');
    
    // 确保目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`创建上传目录: ${uploadDir}`);
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 使用原始文件名，避免中文文件名问题
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

// 使用Python脚本生成题目
router.post('/generate-python-quiz', upload.array('files'), async (req, res) => {
  try {
    console.log('收到Python题目生成请求');
    
    if (!req.files || req.files.length === 0) {
      console.log('没有接收到文件');
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }
    
    console.log(`收到 ${req.files.length} 个文件`);
    req.files.forEach(file => {
      console.log(`- ${file.originalname} (${file.size} bytes)`);
    });
    
    // 调用Python脚本处理文件
    const pythonScriptPath = path.join(__dirname, '../../voicetotext/main.py');
    console.log(`执行Python脚本: ${pythonScriptPath}`);
    
    const pythonProcess = spawn('python', [pythonScriptPath]);
    
    let pythonOutput = '';
    let pythonError = '';
    
    pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
      console.log(`Python输出: ${data}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
      console.error(`Python错误: ${data}`);
    });
    
    const processResult = await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python脚本执行失败，退出码: ${code}, 错误: ${pythonError}`));
        } else {
          resolve(true);
        }
      });
    });
    
    // 读取生成的题目文件
    const quizFilePath = path.join(__dirname, '../../voicetotext/Quiz/generated_quiz.txt');
    
    if (!fs.existsSync(quizFilePath)) {
      return res.status(500).json({ success: false, error: '题目文件未生成' });
    }
    
    const quizContent = fs.readFileSync(quizFilePath, 'utf8');
    
    // 解析题目内容为结构化数据
    const questions = parseQuizContent(quizContent);
    
    // 将题目保存到数据库并创建考试
    const examId = await saveQuestionsToDatabase(questions, req.body.title || '自动生成考试');
    
    res.json({ 
      success: true, 
      examId: examId,
      questions: questions,
      message: '题目生成成功'
    });
    
  } catch (error) {
    console.error('处理文件时出错:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 解析题目内容为结构化数据
function parseQuizContent(content) {
  const questions = [];
  const questionBlocks = content.split(/\\n\\s*\\n/); // 按空行分割题目
  
  questionBlocks.forEach((block, index) => {
    const lines = block.trim().split('\\n');
    if (lines.length < 6) return; // 跳过格式不正确的题目
    
    // 解析题目内容
    const questionMatch = lines[0].match(/^\\d+\\.\\s+(.+)$/);
    if (!questionMatch) return;
    
    const questionContent = questionMatch[1];
    const options = [];
    let answer = '';
    
    // 解析选项和答案
    for (let i = 1; i < lines.length; i++) {
      const optionMatch = lines[i].match(/^([A-D])\\.\\s+(.+)$/);
      if (optionMatch) {
        options.push({
          letter: optionMatch[1],
          content: optionMatch[2]
        });
      }
      
      const answerMatch = lines[i].match(/^答案:\\s+([A-D])$/);
      if (answerMatch) {
        answer = answerMatch[1];
      }
    }
    
    if (options.length >= 2 && answer) {
      questions.push({
        id: index + 1,
        content: questionContent,
        options,
        answer
      });
    }
  });
  
  return questions;
}

// 将题目保存到数据库并创建考试
async function saveQuestionsToDatabase(questions, title) {
  let connection;
  
  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    
    // 开始事务
    await connection.beginTransaction();
    
    // 创建考试记录
    const now = new Date();
    const beginDate = now.toISOString().slice(0, 19).replace('T', ' ');
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    
    const [examResult] = await connection.execute(
      'INSERT INTO th_exam (course_id, author_id, type, title, detail, not_order, begin_date, end_date, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        7, // 默认课程ID
        'stu023', // 默认作者ID
        3, // 默认考试类型
        title || `Python生成考试 - ${new Date().toISOString().slice(0, 10)}`,
        'Python自动生成的考试',
        1,
        beginDate,
        endDate,
        now.toISOString().slice(0, 19).replace('T', ' ')
      ]
    );
    
    const examId = examResult.insertId;
    
    // 处理每个题目
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      // 使用时间戳+索引作为题目ID，避免ID冲突
      const subjectId = parseInt(`${Date.now().toString().slice(-6)}${i + 1}`);
      
      // 插入题目
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
      
      // 将题目添加到试卷
      await connection.execute(
        'INSERT INTO th_paper (exam_id, subject_type, subject_id, subject_num) VALUES (?, ?, ?, ?)',
        [examId, 1, subjectId, i + 1]
      );
    }
    
    // 提交事务
    await connection.commit();
    
    return examId;
  } catch (error) {
    // 回滚事务
    if (connection) await connection.rollback();
    throw error;
  } finally {
    // 关闭连接
    if (connection) await connection.end();
  }
}

module.exports = router;