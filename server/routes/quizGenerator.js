const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const router = express.Router();

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
    // 生成唯一文件名，避免文件名冲突
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(file.originalname);
    const fileName = file.originalname.replace(fileExt, '') + '-' + uniqueSuffix + fileExt;
    
    console.log(`处理上传文件: ${file.originalname} -> ${fileName}`);
    cb(null, fileName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 增加文件大小限制为200MB
  fileFilter: function (req, file, cb) {
    // 允许所有文件类型
    console.log(`接收文件: ${file.originalname}, 类型: ${file.mimetype}`);
    cb(null, true);
  }
});

// 简单的文件上传测试端点
router.post('/simple-upload', upload.single('file'), (req, res) => {
  console.log('收到simple-upload请求');
  try {
    console.log('收到文件上传请求');
    
    if (!req.file) {
      console.log('没有接收到文件');
      return res.status(400).json({ success: false, message: '没有接收到文件' });
    }
    
    console.log(`文件上传成功: ${req.file.originalname}`);
    
    res.json({
      success: true,
      message: '文件上传成功',
      file: {
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        path: req.file.path
      }
    });
  } catch (error) {
    console.error('文件上传处理错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 处理文件上传并生成题目
router.post('/generate-questions', upload.array('files'), async (req, res) => {
  try {
    console.log('收到生成题目请求');
    
    if (!req.files || req.files.length === 0) {
      console.log('没有接收到文件');
      return res.status(400).json({ error: '没有上传文件' });
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
      return res.status(500).json({ error: '题目文件未生成' });
    }
    
    const quizContent = fs.readFileSync(quizFilePath, 'utf8');
    
    // 解析题目内容为结构化数据
    const questions = parseQuizContent(quizContent);
    
    res.json({ success: true, questions });
    
  } catch (error) {
    console.error('处理文件时出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 发布题目到考试
router.post('/publish-to-exam', async (req, res) => {
  try {
    const { questions } = req.body;
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: '没有提供有效的题目数据' });
    }
    
    // 将题目写入临时文件
    const tempFilePath = path.join(__dirname, '../../temp_questions.txt');
    const quizContent = formatQuestionsToText(questions);
    fs.writeFileSync(tempFilePath, quizContent);
    
    console.log(`题目已写入临时文件: ${tempFilePath}`);
    
    // 调用import-single-question.js脚本
    const importScriptPath = path.join(__dirname, '../../import-single-question.js');
    console.log(`执行导入脚本: ${importScriptPath} ${tempFilePath} --create-exam`);
    
    const nodeProcess = spawn('node', [
      importScriptPath,
      tempFilePath,
      '--create-exam'
    ]);
    
    let nodeOutput = '';
    let nodeError = '';
    
    nodeProcess.stdout.on('data', (data) => {
      nodeOutput += data.toString();
      console.log(`Node输出: ${data}`);
    });
    
    nodeProcess.stderr.on('data', (data) => {
      nodeError += data.toString();
      console.error(`Node错误: ${data}`);
    });
    
    await new Promise((resolve, reject) => {
      nodeProcess.on('close', (code) => {
        // 删除临时文件
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log(`临时文件已删除: ${tempFilePath}`);
        }
        
        if (code !== 0) {
          reject(new Error(`导入脚本执行失败，退出码: ${code}, 错误: ${nodeError}`));
        } else {
          resolve(true);
        }
      });
    });
    
    // 从输出中提取考试ID
    const examIdMatch = nodeOutput.match(/考试创建成功，ID: (\d+)/);
    const examId = examIdMatch ? examIdMatch[1] : '未知';
    
    res.json({ success: true, examId });
    
  } catch (error) {
    console.error('发布题目时出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 解析题目文本为结构化数据
function parseQuizContent(content) {
  const questions = [];
  const questionBlocks = content.split(/\n\s*\n/); // 按空行分割题目
  
  questionBlocks.forEach((block, index) => {
    const lines = block.trim().split('\n');
    if (lines.length < 6) return; // 跳过格式不正确的题目
    
    // 解析题目内容
    const questionMatch = lines[0].match(/^\d+\.\s+(.+)$/);
    if (!questionMatch) return;
    
    const questionContent = questionMatch[1];
    const options = [];
    let answer = '';
    
    // 解析选项和答案
    for (let i = 1; i < lines.length; i++) {
      const optionMatch = lines[i].match(/^([A-D])\.\s+(.+)$/);
      if (optionMatch) {
        options.push({
          letter: optionMatch[1],
          content: optionMatch[2]
        });
      }
      
      const answerMatch = lines[i].match(/^答案:\s+([A-D])$/);
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

// 将结构化题目数据格式化为文本
function formatQuestionsToText(questions) {
  let content = '### 选择题\n\n';
  
  questions.forEach((question, index) => {
    content += `${question.id}. ${question.content}\n`;
    
    question.options.forEach(option => {
      content += `${option.letter}. ${option.content}\n`;
    });
    
    content += `答案: ${question.answer}\n\n`;
  });
  
  return content;
}

module.exports = router;