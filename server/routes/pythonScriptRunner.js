const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// 执行Python脚本
router.post('/run-python-script', async (req, res) => {
  try {
    console.log('收到执行Python脚本请求');
    
    const scriptPath = req.body.scriptPath || path.join(__dirname, '../../voicetotext/main.py');
    console.log(`执行Python脚本: ${scriptPath}`);
    
    // 确保脚本存在
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({ success: false, error: `脚本文件不存在: ${scriptPath}` });
    }
    
    // 执行Python脚本
    const pythonProcess = spawn('python', [scriptPath]);
    
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
    
    res.json({ 
      success: true, 
      output: pythonOutput,
      message: 'Python脚本执行成功'
    });
    
  } catch (error) {
    console.error('执行Python脚本时出错:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 读取生成的题目文件
router.get('/read-quiz-file', (req, res) => {
  try {
    console.log('收到读取题目文件请求');
    
    const filePath = req.query.filePath || path.join(__dirname, '../../voicetotext/Quiz/generated_quiz.txt');
    console.log(`读取题目文件: ${filePath}`);
    
    // 确保文件存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: `题目文件不存在: ${filePath}` });
    }
    
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8');
    
    res.json({ 
      success: true, 
      content: content,
      message: '题目文件读取成功'
    });
    
  } catch (error) {
    console.error('读取题目文件时出错:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 上传文件到inputFiles目录
const multer = require('multer');
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

router.post('/upload-to-inputfiles', upload.single('file'), (req, res) => {
  try {
    console.log('收到上传文件到inputFiles请求');
    
    if (!req.file) {
      console.log('没有接收到文件');
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }
    
    console.log(`文件上传成功: ${req.file.originalname} (${req.file.size} bytes)`);
    
    res.json({ 
      success: true, 
      file: {
        originalname: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
      },
      message: '文件上传成功'
    });
    
  } catch (error) {
    console.error('上传文件时出错:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;