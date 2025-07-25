const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

// 导入路由
const quizGeneratorRoutes = require('./routes/quizGenerator');
const simpleExamGeneratorRoutes = require('./routes/simpleExamGenerator');
const pythonQuizGeneratorRoutes = require('./routes/pythonQuizGenerator');
const pythonScriptRunnerRoutes = require('./routes/pythonScriptRunner');
const examGenerationFlowRoutes = require('./routes/examGenerationFlow');

const app = express();
const PORT = process.env.PORT || 3001;

// 配置CORS，允许所有来源
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 添加CORS预检请求处理
app.options('*', cors());

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 打印所有请求
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 静态文件
app.use(express.static(path.join(__dirname, '../dist')));

// API路由
app.use('/api', quizGeneratorRoutes);
app.use('/api', simpleExamGeneratorRoutes);
app.use('/api', pythonQuizGeneratorRoutes);
app.use('/api', pythonScriptRunnerRoutes);
app.use('/api', examGenerationFlowRoutes);

// 添加错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误', 
    error: err.message 
  });
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  // 检查必要的目录是否存在
  const inputDir = path.join(__dirname, '../voicetotext/inputFiles');
  const quizDir = path.join(__dirname, '../voicetotext/Quiz');
  const quizSourceDir = path.join(__dirname, '../voicetotext/txt_QuizSource');
  
  const dirs = {
    inputDir: fs.existsSync(inputDir),
    quizDir: fs.existsSync(quizDir),
    quizSourceDir: fs.existsSync(quizSourceDir)
  };
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    watchDir: inputDir,
    directories: dirs,
    version: '1.0.0'
  });
});

// 文件上传测试端点
app.post('/api/test-upload', (req, res) => {
  console.log('收到测试上传请求');
  
  try {
    // 直接返回成功响应，不处理文件
    res.json({
      success: true,
      message: '测试成功',
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error('测试上传失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 直接的文件上传处理端点 - 使用更简单的方法
app.post('/api/simple-upload', upload.single('file'), function(req, res) {
  console.log('收到simple-upload请求 - 直接使用中间件');
  console.log('请求头:', JSON.stringify(req.headers));
  
  try {
    if (!req.file) {
      console.log('没有接收到文件');
      return res.status(400).json({ success: false, message: '没有接收到文件' });
    }
    
    console.log(`文件上传成功: ${req.file.originalname}`);
    
    // 返回成功响应
    return res.json({
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
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 所有其他请求返回前端应用
app.get('/', (req, res) => {
  res.send('服务器运行正常');
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

module.exports = app;