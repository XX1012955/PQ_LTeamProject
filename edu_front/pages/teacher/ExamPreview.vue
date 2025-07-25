<template>
  <div class="exam-preview-container">
    <el-card class="exam-preview-card">
      <div slot="header" class="header-container">
        <span class="header-title">考试预览</span>
        <div class="header-actions">
          <el-button type="primary" @click="publishExam" :loading="publishing">发布考试</el-button>
          <el-button type="danger" @click="deleteExam" :loading="deleting">删除考试</el-button>
          <el-button @click="goBack">返回</el-button>
        </div>
      </div>
      
      <div v-if="loading" class="loading-container">
        <i class="el-icon-loading"></i>
        <p>加载考试内容中...</p>
      </div>
      
      <div v-else>
        <!-- 考试基本信息 -->
        <div class="exam-info-section">
          <el-form :model="examInfo" label-width="100px" size="medium">
            <el-form-item label="考试标题">
              <el-input v-model="examInfo.title" :disabled="!editMode"></el-input>
            </el-form-item>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="开始时间">
                  <el-date-picker
                    v-model="examInfo.beginDate"
                    type="datetime"
                    placeholder="选择开始时间"
                    :disabled="!editMode"
                    value-format="yyyy-MM-dd HH:mm:ss">
                  </el-date-picker>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="结束时间">
                  <el-date-picker
                    v-model="examInfo.endDate"
                    type="datetime"
                    placeholder="选择结束时间"
                    :disabled="!editMode"
                    value-format="yyyy-MM-dd HH:mm:ss">
                  </el-date-picker>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="考试说明">
              <el-input 
                type="textarea" 
                v-model="examInfo.detail" 
                :rows="3"
                :disabled="!editMode">
              </el-input>
            </el-form-item>
            <el-form-item>
              <el-button v-if="!editMode" type="primary" @click="editMode = true">编辑信息</el-button>
              <el-button v-else type="success" @click="saveExamInfo">保存信息</el-button>
              <el-button v-if="editMode" @click="cancelEdit">取消</el-button>
            </el-form-item>
          </el-form>
        </div>
        
        <el-divider content-position="center">考试题目</el-divider>
        
        <!-- 题目列表 -->
        <div class="questions-section">
          <div v-for="(question, index) in questions" :key="index" class="question-item">
            <div class="question-header">
              <h3>{{ index + 1 }}. {{ question.question }}</h3>
              <div class="question-actions">
                <el-tooltip content="编辑题目" placement="top">
                  <i class="el-icon-edit" @click="editQuestion(index)"></i>
                </el-tooltip>
                <el-tooltip content="删除题目" placement="top">
                  <i class="el-icon-delete" @click="deleteQuestion(index)"></i>
                </el-tooltip>
              </div>
            </div>
            
            <div class="options-container">
              <div 
                v-for="option in question.options" 
                :key="option.num" 
                class="option-item"
                :class="{'correct-answer': option.is_answer === 1}">
                <span class="option-letter">{{ String.fromCharCode(64 + option.num) }}.</span>
                <span class="option-content">{{ option.content }}</span>
                <span v-if="option.is_answer === 1" class="answer-mark">
                  <i class="el-icon-check"></i> 正确答案
                </span>
              </div>
            </div>
            
            <div class="question-footer">
              <span class="score-label">分值：</span>
              <el-input-number 
                v-model="question.score" 
                :min="1" 
                :max="20" 
                size="mini">
              </el-input-number>
            </div>
          </div>
          
          <!-- 无题目提示 -->
          <div v-if="questions.length === 0" class="no-questions">
            <i class="el-icon-warning"></i>
            <p>当前考试没有题目，请检查源文件或重新生成</p>
          </div>
        </div>
      </div>
    </el-card>
    
    <!-- 编辑题目对话框 -->
    <el-dialog
      title="编辑题目"
      :visible.sync="questionDialogVisible"
      width="50%">
      <el-form :model="currentQuestion" label-width="80px" v-if="currentQuestion">
        <el-form-item label="题目">
          <el-input type="textarea" v-model="currentQuestion.question" :rows="3"></el-input>
        </el-form-item>
        
        <el-form-item 
          v-for="(option, index) in currentQuestion.options" 
          :key="index"
          :label="`选项${String.fromCharCode(65 + index)}`">
          <el-input v-model="option.content">
            <template slot="append">
              <el-radio 
                v-model="currentQuestionAnswer" 
                :label="index"
                @change="updateCorrectAnswer">
                正确答案
              </el-radio>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="分值">
          <el-input-number v-model="currentQuestion.score" :min="1" :max="20"></el-input-number>
        </el-form-item>
      </el-form>
      
      <span slot="footer" class="dialog-footer">
        <el-button @click="questionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveQuestion">确定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: "ExamPreview",
  data() {
    return {
      examId: null,
      examInfo: {
        title: '',
        beginDate: '',
        endDate: '',
        detail: ''
      },
      questions: [],
      loading: true,
      publishing: false,
      deleting: false,
      editMode: false,
      originalExamInfo: null,
      
      // 编辑题目相关
      questionDialogVisible: false,
      currentQuestion: null,
      currentQuestionIndex: -1,
      currentQuestionAnswer: -1
    };
  },
  created() {
    this.examId = this.$route.params.examId;
    if (!this.examId) {
      this.$message.error('未找到考试ID');
      this.goBack();
      return;
    }
    
    this.loadExamDetails();
  },
  methods: {
    // 加载考试详情
    loadExamDetails() {
      this.loading = true;
      this.$axios.get(`http://localhost:3001/api/Exam/getExamDetails/${this.examId}`).then(res => {
        this.loading = false;
        if (res.data.flag) {
          const examData = res.data.data;
          this.examInfo = { ...examData.exam };
          this.questions = examData.questions || [];
          
          // 保存原始信息，用于取消编辑
          this.originalExamInfo = JSON.parse(JSON.stringify(this.examInfo));
        } else {
          this.$message.error('加载考试详情失败: ' + (res.data.message || '未知错误'));
        }
      }).catch(err => {
        this.loading = false;
        this.$message.error('加载考试详情失败: ' + (err.message || '未知错误'));
      });
    },
    
    // 发布考试
    publishExam() {
      this.$confirm('确定要发布此考试吗？发布后学生将可以参加考试。', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }).then(() => {
        this.publishing = true;
        
        // 这里应该调用发布考试的API
        // 由于我们没有具体的API，这里模拟一个请求
        setTimeout(() => {
          this.publishing = false;
          this.$message.success('考试已成功发布');
          this.goBack();
        }, 1000);
        
        // 实际代码应该类似：
        /*
        this.$axios.post(`/api/teacher/publishExam/${this.examId}`).then(res => {
          this.publishing = false;
          if (res.data.flag) {
            this.$message.success('考试已成功发布');
            this.goBack();
          } else {
            this.$message.error(res.data.message || '发布考试失败');
          }
        }).catch(err => {
          this.publishing = false;
          this.$message.error('发布考试失败: ' + err.message);
        });
        */
      }).catch(() => {
        // 取消发布
      });
    },
    
    // 删除考试
    deleteExam() {
      this.$confirm('确定要删除此考试吗？此操作不可恢复。', '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.deleting = true;
        
        this.$axios.delete(`http://localhost:3001/api/Exam/deleteExam/${this.examId}`).then(res => {
          this.deleting = false;
          if (res.data.flag) {
            this.$message.success('考试已成功删除');
            this.goBack();
          } else {
            this.$message.error(res.data.message || '删除考试失败');
          }
        }).catch(err => {
          this.deleting = false;
          this.$message.error('删除考试失败: ' + err.message);
        });
      }).catch(() => {
        // 取消删除
      });
    },
    
    // 保存考试信息
    saveExamInfo() {
      // 验证日期
      if (new Date(this.examInfo.beginDate) >= new Date(this.examInfo.endDate)) {
        this.$message.error('开始时间必须早于结束时间');
        return;
      }
      
      // 这里应该调用更新考试信息的API
      // 由于我们没有具体的API，这里模拟一个请求
      this.loading = true;
      setTimeout(() => {
        this.loading = false;
        this.editMode = false;
        this.$message.success('考试信息已更新');
        
        // 更新原始信息
        this.originalExamInfo = JSON.parse(JSON.stringify(this.examInfo));
      }, 1000);
      
      // 实际代码应该类似：
      /*
      this.$axios.post(`/api/teacher/updateExam/${this.examId}`, this.examInfo).then(res => {
        this.loading = false;
        if (res.data.flag) {
          this.editMode = false;
          this.$message.success('考试信息已更新');
          this.originalExamInfo = JSON.parse(JSON.stringify(this.examInfo));
        } else {
          this.$message.error(res.data.message || '更新考试信息失败');
        }
      }).catch(err => {
        this.loading = false;
        this.$message.error('更新考试信息失败: ' + err.message);
      });
      */
    },
    
    // 取消编辑
    cancelEdit() {
      this.examInfo = JSON.parse(JSON.stringify(this.originalExamInfo));
      this.editMode = false;
    },
    
    // 编辑题目
    editQuestion(index) {
      this.currentQuestionIndex = index;
      this.currentQuestion = JSON.parse(JSON.stringify(this.questions[index]));
      
      // 找出正确答案的索引
      this.currentQuestionAnswer = -1;
      for (let i = 0; i < this.currentQuestion.options.length; i++) {
        if (this.currentQuestion.options[i].is_answer === 1) {
          this.currentQuestionAnswer = i;
          break;
        }
      }
      
      this.questionDialogVisible = true;
    },
    
    // 更新正确答案
    updateCorrectAnswer() {
      if (this.currentQuestion && this.currentQuestion.options) {
        for (let i = 0; i < this.currentQuestion.options.length; i++) {
          this.currentQuestion.options[i].is_answer = (i === this.currentQuestionAnswer) ? 1 : 0;
        }
      }
    },
    
    // 保存题目
    saveQuestion() {
      if (!this.currentQuestion.question || this.currentQuestion.question.trim() === '') {
        this.$message.error('题目内容不能为空');
        return;
      }
      
      if (this.currentQuestionAnswer === -1) {
        this.$message.error('请选择一个正确答案');
        return;
      }
      
      // 更新题目
      this.questions[this.currentQuestionIndex] = this.currentQuestion;
      
      // 关闭对话框
      this.questionDialogVisible = false;
      this.$message.success('题目已更新');
      
      // 这里应该调用更新题目的API
      // 由于我们没有具体的API，这里只是更新了本地数据
      // 实际代码应该发送请求到后端
    },
    
    // 删除题目
    deleteQuestion(index) {
      this.$confirm('确定要删除此题目吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.questions.splice(index, 1);
        this.$message.success('题目已删除');
        
        // 这里应该调用删除题目的API
        // 由于我们没有具体的API，这里只是更新了本地数据
        // 实际代码应该发送请求到后端
      }).catch(() => {
        // 取消删除
      });
    },
    
    // 返回上一页
    goBack() {
      this.$router.go(-1);
    }
  }
};
</script>

<style scoped>
.exam-preview-container {
  padding: 20px;
}

.exam-preview-card {
  margin-bottom: 20px;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 18px;
  font-weight: bold;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.loading-container i {
  font-size: 40px;
  margin-bottom: 10px;
}

.exam-info-section {
  margin-bottom: 20px;
}

.questions-section {
  margin-top: 20px;
}

.question-item {
  background-color: #f9f9f9;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 20px;
  border-left: 4px solid #409EFF;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.question-header h3 {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
}

.question-actions {
  display: flex;
  gap: 10px;
}

.question-actions i {
  cursor: pointer;
  font-size: 18px;
  color: #606266;
}

.question-actions i:hover {
  color: #409EFF;
}

.question-actions i.el-icon-delete:hover {
  color: #F56C6C;
}

.options-container {
  margin-left: 20px;
  margin-bottom: 15px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 4px;
  background-color: #fff;
}

.option-letter {
  margin-right: 10px;
  font-weight: bold;
}

.option-content {
  flex: 1;
}

.correct-answer {
  background-color: #f0f9eb;
  border: 1px solid #e1f3d8;
}

.answer-mark {
  color: #67C23A;
  margin-left: 10px;
  font-weight: bold;
}

.question-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.score-label {
  margin-right: 10px;
}

.no-questions {
  text-align: center;
  padding: 40px 0;
  color: #909399;
}

.no-questions i {
  font-size: 40px;
  margin-bottom: 10px;
}
</style>