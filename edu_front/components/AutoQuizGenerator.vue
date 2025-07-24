<template>
  <div class="auto-quiz-generator">
    <h3>自动出题系统</h3>
    
    <el-card class="intro-card">
      <div slot="header" class="clearfix">
        <span>系统介绍</span>
      </div>
      <p>本系统可以根据上传的文本文件自动生成选择题。支持多种文件格式，包括：</p>
      <ul>
        <li><strong>文本文件</strong>：.txt、.doc、.docx、.ppt、.pptx、.xls、.xlsx</li>
        <li><strong>图像文件</strong>：.jpg、.jpeg、.png</li>
        <li><strong>PDF文件</strong>：.pdf</li>
      </ul>
      <p>上传文件后，系统会自动处理内容并生成相关的选择题，您可以预览并发布到考试系统。</p>
    </el-card>
    
    <div class="upload-area">
      <el-upload
        class="upload-demo"
        drag
        action="#"
        :http-request="customUpload"
        :on-change="handleFileChange"
        :file-list="fileList"
        :multiple="true"
        :auto-upload="false">
        <i class="el-icon-upload"></i>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <div class="el-upload__tip" slot="tip">支持多种文件格式，单个文件不超过200MB</div>
      </el-upload>
      <el-button type="primary" @click="uploadFiles" :disabled="!selectedFiles.length || isUploading" class="upload-btn">
        {{ isUploading ? '处理中...' : '上传并生成题目' }}
      </el-button>
    </div>
    
    <div v-if="isUploading" class="progress">
      <div class="progress-bar"></div>
    </div>
    
    <div v-if="generatedQuestions.length" class="questions-preview">
      <h4>生成的题目预览</h4>
      <el-card v-for="(question, index) in generatedQuestions" :key="index" class="question-card">
        <div class="question">
          <p class="question-title">{{ question.id }}. {{ question.content }}</p>
          <div v-for="option in question.options" :key="option.letter" class="option" :class="{'correct-option': option.letter === question.answer}">
            {{ option.letter }}. {{ option.content }}
          </div>
          <p class="answer">答案: {{ question.answer }}</p>
        </div>
      </el-card>
      
      <div class="action-buttons">
        <el-button type="primary" @click="publishToExam" :loading="isPublishing" class="publish-btn">
          {{ isPublishing ? '发布中...' : '发布到考试' }}
        </el-button>
        <el-button type="info" @click="clearQuestions" plain>清空题目</el-button>
      </div>
    </div>
    
    <div v-if="errorMessage" class="error">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'AutoQuizGenerator',
  data() {
    return {
      selectedFiles: [],
      fileList: [],
      isUploading: false,
      isPublishing: false,
      generatedQuestions: [],
      errorMessage: ''
    }
  },
  methods: {
    handleFileChange(file) {
      // Element UI上传组件的文件变化处理
      this.selectedFiles.push(file.raw);
      this.errorMessage = '';
    },
    // 自定义上传方法，用于Element UI上传组件
    customUpload(options) {
      // 不执行任何操作，由uploadFiles方法统一处理
      return;
    },
    async uploadFiles() {
      if (!this.selectedFiles.length) return;
      
      this.isUploading = true;
      this.errorMessage = '';
      
      try {
        const formData = new FormData();
        this.selectedFiles.forEach(file => {
          formData.append('files', file);
        });
        
        // 调用后端API处理文件
        const response = await axios.post('/api/generate-questions', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        this.generatedQuestions = response.data.questions;
        
      } catch (error) {
        this.errorMessage = `处理文件时出错: ${error.response?.data?.error || error.message}`;
        console.error('Error:', error);
      } finally {
        this.isUploading = false;
      }
    },
    async publishToExam() {
      if (!this.generatedQuestions.length) return;
      
      this.isPublishing = true;
      this.errorMessage = '';
      
      try {
        // 调用后端API发布题目到考试
        const response = await axios.post('/api/publish-to-exam', {
          questions: this.generatedQuestions
        });
        
        this.$message.success(`题目已成功发布到考试！考试ID: ${response.data.examId}`);
        
        // 清空已生成的题目
        this.clearQuestions();
        
      } catch (error) {
        this.errorMessage = `发布题目时出错: ${error.response?.data?.error || error.message}`;
        console.error('Error:', error);
      } finally {
        this.isPublishing = false;
      }
    },
    
    // 清空已生成的题目和选择的文件
    clearQuestions() {
      this.generatedQuestions = [];
      this.selectedFiles = [];
      this.fileList = [];
      this.errorMessage = '';
    }
  }
}
</script>

<style scoped>
.auto-quiz-generator {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.upload-area {
  border: 2px dashed #ccc;
  padding: 20px;
  text-align: center;
  margin-bottom: 20px;
  border-radius: 5px;
}

.progress {
  margin: 20px 0;
}

.progress-bar {
  height: 10px;
  background: linear-gradient(45deg, #4CAF50 25%, #8BC34A 25%, #8BC34A 50%, #4CAF50 50%, #4CAF50 75%, #8BC34A 75%);
  background-size: 20px 20px;
  width: 100%;
  animation: progress-animation 2s infinite linear;
  border-radius: 5px;
}

@keyframes progress-animation {
  0% { background-position: 0 0; }
  100% { background-position: 40px 0; }
}

.questions-preview {
  margin-top: 20px;
  border: 1px solid #eee;
  padding: 15px;
  border-radius: 5px;
  background-color: #f9f9f9;
}

.question {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.option {
  margin-left: 20px;
  padding: 5px 0;
  border-radius: 4px;
  padding-left: 10px;
}

.correct-option {
  background-color: rgba(76, 175, 80, 0.1);
}

.answer {
  font-weight: bold;
  color: #4CAF50;
  margin-top: 10px;
  border-top: 1px dashed #eee;
  padding-top: 8px;
}

.question-title {
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 10px;
}

.question-card {
  margin-bottom: 15px;
}

.intro-card {
  margin-bottom: 20px;
}

.action-buttons {
  margin-top: 20px;
  text-align: center;
}

.error {
  color: #f44336;
  margin-top: 20px;
  padding: 10px;
  background-color: #ffebee;
  border-radius: 5px;
}

button {
  padding: 10px 15px;
  border: none;
  cursor: pointer;
  margin-top: 10px;
  border-radius: 4px;
  font-weight: bold;
}

.upload-btn {
  background-color: #2196F3;
  color: white;
}

.publish-btn {
  background-color: #4CAF50;
  color: white;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

input[type="file"] {
  margin-bottom: 10px;
}
</style>