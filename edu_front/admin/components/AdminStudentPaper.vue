<template>
    <div class="admin-student-paper">
        <!-- 页面标题和返回按钮 -->
        <el-page-header @back="goBack" :content="pageTitle" class="page-header">
        </el-page-header>

        <!-- 调试信息 -->
        <el-card v-if="!student && !loading" shadow="hover" style="margin-bottom: 15px;">
            <div slot="header">
                <span>调试信息</span>
                <el-button style="float: right; padding: 3px 0" type="text" @click="fetchData">重新加载</el-button>
            </div>
            <div>
                <p><strong>ExamID:</strong> {{ examId }}</p>
                <p><strong>StudentID:</strong> {{ studentId }}</p>
                <p><strong>加载状态:</strong> {{ loading ? '加载中' : '加载完成' }}</p>
                <p><strong>考试信息:</strong> {{ exam ? '已加载' : '未加载' }}</p>
                <p><strong>试题数量:</strong> {{ subjects.length }}</p>
                <p><strong>学生信息:</strong> {{ student ? '已加载' : '未找到学生' }}</p>
                <el-alert
                    v-if="!student && !loading"
                    title="未能找到学生答卷数据，请检查学生ID是否正确"
                    type="warning"
                    show-icon>
                </el-alert>
            </div>
        </el-card>

        <div v-loading="loading">
            <!-- 基本信息卡片 -->
            <el-card class="info-card" shadow="hover">
                <div v-if="exam" class="basic-info">
                    <h2>{{ exam.title }}</h2>
                    <div class="info-meta">
                        <span><i class="el-icon-date"></i> 考试时间: {{ formatDateTime(exam.beginDate) }} 至 {{ formatDateTime(exam.endDate) }}</span>
                        <el-tag type="info">总分值: {{ getTotalScore() }}分</el-tag>
                    </div>
                </div>

                <el-divider content-position="left">学生信息</el-divider>

                <div v-if="student" class="student-info">
                    <div class="avatar-box">
                        <el-avatar :size="80" :src="student.userAvatar || '/imgs/user/default.jpg'"></el-avatar>
                    </div>
                    <div class="student-data">
                        <el-descriptions :column="3" border size="medium">
                            <el-descriptions-item label="学号">{{ student.userId }}</el-descriptions-item>
                            <el-descriptions-item label="姓名">{{ student.username }}</el-descriptions-item>
                            <el-descriptions-item label="提交时间">{{ formatDateTime(student.submitTime) }}</el-descriptions-item>
                            <el-descriptions-item label="客观题得分">{{ student.objectiveScore || '0' }}分</el-descriptions-item>
                            <el-descriptions-item label="总分">{{ student.score || '未评分' }}</el-descriptions-item>
                            <el-descriptions-item label="状态">
                                <el-tag :type="student.isCheckedBool ? 'success' : 'warning'">
                                    {{ student.isCheckedBool ? '已批改' : '待批改' }}
                                </el-tag>
                            </el-descriptions-item>
                        </el-descriptions>
                    </div>
                </div>
            </el-card>

            <!-- 答题详情 -->
            <el-card class="answers-card" shadow="hover">
                <div slot="header">
                    <span>答题详情</span>
                    <div class="card-actions">
                        <el-button type="text" @click="expandAll">全部展开</el-button>
                        <el-button type="text" @click="collapseAll">全部折叠</el-button>
                    </div>
                </div>

                <div v-if="!student || !student.solutions || student.solutions.length === 0" class="empty-data">
                    暂无答题记录
                </div>

                <el-collapse v-else v-model="activeNames">
                    <el-collapse-item 
                        v-for="(solution, index) in student.solutions" 
                        :key="index"
                        :name="index">

                        <template slot="title">
                            <div class="question-header">
                                <span class="question-number">第 {{ index + 1 }} 题</span>
                                <el-tag size="medium" class="question-type">
                                    {{ getQuestionTypeName(solution.subjectType) }}
                                </el-tag>
                                <span class="question-score">
                                    <el-tag 
                                        :type="getScoreTagType(solution, index)" 
                                        size="medium">
                                        得分: {{ solution.score || '0' }} / {{ getMaxScore(solution, index) }}
                                    </el-tag>
                                </span>
                            </div>
                        </template>

                        <!-- 题目内容 -->
                        <div class="question-content">
                            <div class="content-section">
                                <div class="section-title">题目内容:</div>
                                <div class="section-body" v-if="subjects[index]">
                                    <!-- 选择题 -->
                                    <template v-if="solution.subjectType === 1">
                                        <div>{{ subjects[index].choice.content }}</div>
                                        <div class="options">
                                            <div v-for="(option, optIndex) in subjects[index].choice.options" :key="optIndex" class="option">
                                                <span class="option-label">{{ String.fromCharCode(65 + optIndex) }}:</span>
                                                <span>{{ option }}</span>
                                            </div>
                                        </div>
                                    </template>

                                    <!-- 填空题 -->
                                    <div v-else-if="solution.subjectType === 2">
                                        {{ subjects[index].filling.content }}
                                    </div>

                                    <!-- 判断题 -->
                                    <div v-else-if="solution.subjectType === 3">
                                        {{ subjects[index].trueFalse.content }}
                                    </div>

                                    <!-- 简答题 -->
                                    <div v-else-if="solution.subjectType === 4">
                                        {{ subjects[index].questionAnswer.content }}
                                    </div>
                                </div>
                            </div>

                            <!-- 学生答案 -->
                            <div class="content-section">
                                <div class="section-title">学生答案:</div>
                                <div class="section-body">
                                    <!-- 选择题 -->
                                    <div v-if="solution.subjectType === 1" class="student-choice">
                                        <span>选择: </span>
                                        <el-tag 
                                            v-for="answer in solution.answers.split(',')" 
                                            :key="answer"
                                            size="small"
                                            :type="isCorrectAnswer(solution, answer, index) ? 'success' : 'danger'">
                                            {{ String.fromCharCode(64 + parseInt(answer)) }}
                                        </el-tag>
                                    </div>

                                    <!-- 填空题 -->
                                    <div v-else-if="solution.subjectType === 2" class="filling-answer">
                                        <el-tag 
                                            v-for="(answer, i) in solution.answers.split(',')" 
                                            :key="i"
                                            size="medium"
                                            :type="isCorrectFillingAnswer(solution, answer, i, index) ? 'success' : 'danger'">
                                            {{ answer }}
                                        </el-tag>
                                    </div>

                                    <!-- 判断题 -->
                                    <div v-else-if="solution.subjectType === 3">
                                        <el-tag :type="isCorrectTrueFalse(solution, index) ? 'success' : 'danger'">
                                            {{ solution.answers === '1' ? '正确' : '错误' }}
                                        </el-tag>
                                    </div>

                                    <!-- 简答题 -->
                                    <div v-else-if="solution.subjectType === 4" class="essay-answer">
                                        <div class="answer-text">{{ solution.answers || '未作答' }}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- 标准答案 -->
                            <div class="content-section">
                                <div class="section-title">标准答案:</div>
                                <div class="section-body" v-if="subjects[index]">
                                    <!-- 选择题 -->
                                    <div v-if="solution.subjectType === 1" class="standard-choice">
                                        <span>正确答案: </span>
                                        <el-tag 
                                            v-for="answer in getCorrectChoiceAnswers(index)" 
                                            :key="answer"
                                            size="small"
                                            type="success">
                                            {{ String.fromCharCode(64 + parseInt(answer)) }}
                                        </el-tag>
                                    </div>

                                    <!-- 填空题 -->
                                    <div v-else-if="solution.subjectType === 2" class="standard-filling">
                                        <el-tag 
                                            v-for="(answer, i) in subjects[index].filling.answer.split(',')" 
                                            :key="i"
                                            size="medium"
                                            type="success">
                                            {{ answer }}
                                        </el-tag>
                                    </div>

                                    <!-- 判断题 -->
                                    <div v-else-if="solution.subjectType === 3">
                                        <el-tag type="success">
                                            {{ subjects[index].trueFalse.answer === '1' ? '正确' : '错误' }}
                                        </el-tag>
                                    </div>

                                    <!-- 简答题 -->
                                    <div v-else-if="solution.subjectType === 4" class="standard-essay">
                                        <div class="answer-text">{{ subjects[index].questionAnswer.answer || '无标准答案' }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </el-collapse-item>
                </el-collapse>
            </el-card>
        </div>
    </div>
</template>

<script>
export default {
    name: "AdminStudentPaper",
    data() {
        return {
            loading: false,
            pageTitle: "学生答卷详情",
            examId: null,
            studentId: null,
            exam: null,
            student: null,
            subjects: [],
            activeNames: [],
        };
    },
    created() {
        console.log("AdminStudentPaper组件创建");
        console.log("路由参数:", this.$route.params);

        // 获取路由参数
        this.examId = this.$route.params.examId;
        this.studentId = this.$route.params.studentId;

        // 记录参数到控制台
        console.log(`获取到路由参数 - examId: ${this.examId}, studentId: ${this.studentId}`);

        if (!this.examId || !this.studentId) {
            this.$message({
                message: "参数错误，无法查看学生答卷详情",
                type: "error",
                duration: 5000,
                showClose: true
            });
            console.error("缺少必要的参数 examId 或 studentId");
            setTimeout(() => {
                this.goBack();
            }, 1500);
            return;
        }

        // 延迟一点启动数据加载，确保组件完全挂载
        this.$nextTick(() => {
            this.fetchData();
        });
    },
    methods: {
        // 返回上一页
        goBack() {
            this.$router.go(-1);
        },

        // 获取所有数据
        fetchData() {
            this.loading = true;
            console.log("开始获取数据，examId:", this.examId, "studentId:", this.studentId);

            // 同步获取所有数据，避免异步问题
            Promise.all([
                // 获取考试信息
                this.$axios.post("/Exam/getExamById", { examId: this.examId }),
                // 获取试题信息
                this.$axios.post("/Paper/getPaperByExamId", { examId: this.examId }),
                // 获取学生答题信息
                this.$axios.post("/Answer/getAllUserAnswer", { examId: this.examId })
            ]).then(([examRes, paperRes, answersRes]) => {
                // 处理考试信息
                if (examRes.data && examRes.data.flag) {
                    this.exam = examRes.data.data;
                    this.pageTitle = `${this.exam.title} - 学生答卷`;
                    console.log("考试信息获取成功:", this.exam.title);
                } else {
                    this.$message.error("获取考试信息失败");
                    console.error("考试信息获取失败:", examRes);
                }

                // 处理试题信息
                if (paperRes.data && paperRes.data.flag) {
                    this.subjects = paperRes.data.data;
                    console.log("试题信息获取成功，共", this.subjects.length, "道题");
                } else {
                    this.$message.error("获取试题信息失败");
                    console.error("试题信息获取失败:", paperRes);
                }

                // 处理学生答题信息
                if (answersRes.data && answersRes.data.flag) {
                    const students = answersRes.data.data;
                    console.log("获取到", students.length, "名学生的答题记录");

                    // 确保studentId是字符串类型进行比较
                    const studentIdStr = String(this.studentId);
                    this.student = students.find(s => String(s.userId) === studentIdStr);

                    if (this.student) {
                        console.log("找到学生:", this.student.username, "的答题记录");
                        // 默认展开第一题
                        if (this.student.solutions && this.student.solutions.length > 0) {
                            this.activeNames = [0];
                            console.log("学生有", this.student.solutions.length, "道题的答题记录");
                        } else {
                            console.log("学生没有答题记录");
                        }
                    } else {
                        console.error("未找到该学生的答题记录，学生ID:", this.studentId);
                        this.$message.error("未找到该学生的答题记录");
                    }
                } else {
                    this.$message.error("获取学生答题信息失败");
                    console.error("学生答题信息获取失败:", answersRes);
                }
            }).catch(err => {
                console.error("数据加载出错:", err);
                this.$message.error("数据加载失败，请稍后重试");
            }).finally(() => {
                this.loading = false;
                console.log("数据加载完成，关闭loading");
            });
        },

        // 展开所有题目
        expandAll() {
            if (this.student && this.student.solutions) {
                this.activeNames = this.student.solutions.map((_, index) => index);
            }
        },

        // 折叠所有题目
        collapseAll() {
            this.activeNames = [];
        },

        // 获取题型名称
        getQuestionTypeName(type) {
            switch (type) {
                case 1: return "选择题";
                case 2: return "填空题";
                case 3: return "判断题";
                case 4: return "简答题";
                default: return "未知题型";
            }
        },

        // 获取得分标签类型
        getScoreTagType(solution, index) {
            const maxScore = this.getMaxScore(solution, index);
            const score = solution.score || 0;

            if (parseFloat(score) === parseFloat(maxScore)) return "success";
            if (parseFloat(score) > 0) return "warning";
            return "danger";
        },

        // 获取题目满分
        getMaxScore(solution, index) {
            if (!this.subjects[index]) return 0;

            switch (solution.subjectType) {
                case 1: return this.subjects[index].choice?.score || 0;
                case 2: return this.subjects[index].filling?.score || 0;
                case 3: return this.subjects[index].trueFalse?.score || 0;
                case 4: return this.subjects[index].questionAnswer?.score || 0;
                default: return 0;
            }
        },

        // 获取考试总分
        getTotalScore() {
            if (!this.subjects || this.subjects.length === 0) return 0;

            return this.subjects.reduce((total, subject) => {
                if (subject.choice) total += parseFloat(subject.choice.score || 0);
                if (subject.filling) total += parseFloat(subject.filling.score || 0);
                if (subject.trueFalse) total += parseFloat(subject.trueFalse.score || 0);
                if (subject.questionAnswer) total += parseFloat(subject.questionAnswer.score || 0);
                return total;
            }, 0);
        },

        // 判断选择题答案是否正确
        isCorrectAnswer(solution, answer, index) {
            if (!this.subjects[index] || !this.subjects[index].choice) return false;
            const correctAnswers = this.subjects[index].choice.answer.split(",");
            return correctAnswers.includes(answer);
        },

        // 获取正确的选择题答案
        getCorrectChoiceAnswers(index) {
            if (!this.subjects[index] || !this.subjects[index].choice) return [];
            return this.subjects[index].choice.answer.split(",");
        },

        // 判断填空题答案是否正确
        isCorrectFillingAnswer(solution, answer, index, questionIndex) {
            if (!this.subjects[questionIndex] || !this.subjects[questionIndex].filling) return false;
            const correctAnswers = this.subjects[questionIndex].filling.answer.split(",");
            if (index >= correctAnswers.length) return false;

            // 简单的字符串比较，实际可能需要更复杂的比较逻辑
            return answer.trim().toLowerCase() === correctAnswers[index].trim().toLowerCase();
        },

        // 判断判断题答案是否正确
        isCorrectTrueFalse(solution, index) {
            if (!this.subjects[index] || !this.subjects[index].trueFalse) return false;
            return solution.answers === this.subjects[index].trueFalse.answer;
        },

        // 格式化日期时间
        formatDateTime(dateStr) {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hour = date.getHours().toString().padStart(2, '0');
            const minute = date.getMinutes().toString().padStart(2, '0');
            return `${year}-${month}-${day} ${hour}:${minute}`;
        }
    }
};
</script>

<style scoped>
.admin-student-paper {
    padding: 20px;
}

.page-header {
    margin-bottom: 20px;
}

.info-card, .answers-card {
    margin-bottom: 20px;
}

.basic-info h2 {
    margin-top: 0;
    margin-bottom: 15px;
}

.info-meta {
    display: flex;
    gap: 20px;
    align-items: center;
    color: #606266;
    margin-bottom: 10px;
}

.student-info {
    display: flex;
    gap: 20px;
    align-items: center;
}

.avatar-box {
    flex-shrink: 0;
}

.student-data {
    flex-grow: 1;
}

.card-actions {
    float: right;
}

.question-header {
    display: flex;
    align-items: center;
    gap: 15px;
}

.question-number {
    font-weight: bold;
    min-width: 60px;
}

.question-type {
    min-width: 60px;
    text-align: center;
}

.question-score {
    margin-left: auto;
}

.question-content {
    padding: 15px;
    background-color: #f9f9f9;
    border-radius: 4px;
}

.content-section {
    margin-bottom: 20px;
}

.section-title {
    font-weight: bold;
    margin-bottom: 8px;
    color: #409EFF;
}

.section-body {
    line-height: 1.6;
}

.options {
    margin-top: 10px;
}

.option {
    margin-bottom: 5px;
}

.option-label {
    display: inline-block;
    width: 30px;
    font-weight: bold;
}

.student-choice, .standard-choice, .filling-answer, .standard-filling {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
}

.answer-text {
    white-space: pre-wrap;
    background-color: #fff;
    padding: 10px;
    border: 1px solid #EBEEF5;
    border-radius: 4px;
}

.empty-data {
    text-align: center;
    padding: 40px;
    color: #909399;
    font-size: 16px;
}
</style>