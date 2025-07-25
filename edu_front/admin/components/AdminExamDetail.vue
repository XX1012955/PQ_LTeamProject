<template>
    <div class="admin-exam-detail">
        <!-- 页面标题和返回按钮 -->
        <el-page-header @back="goBack" :content="examTitle" class="page-header">
        </el-page-header>

        <div v-loading="loading">
            <!-- 考试信息卡片 -->
            <el-card class="exam-info-card" v-if="exam">
                <div class="exam-header">
                    <h2>{{ exam.title }}</h2>
                    <div class="exam-meta">
                        <span><i class="el-icon-date"></i> 创建时间: {{ formatDateTime(exam.createTime) }}</span>
                        <span><i class="el-icon-time"></i> 考试时间: {{ formatDateTime(exam.beginDate) }} 至 {{ formatDateTime(exam.endDate) }}</span>
                        <el-tag :type="getStatusType(exam)">{{ getStatusText(exam) }}</el-tag>
                    </div>
                </div>

                <div class="exam-description" v-if="exam.detail" v-html="exam.detail"></div>
            </el-card>

            <!-- 统计信息 -->
            <el-card class="stats-card">
                <el-row :gutter="20">
                    <el-col :span="6">
                        <div class="stat-box">
                            <div class="stat-value primary">{{ totalStudents }}</div>
                            <div class="stat-label">参与学生</div>
                        </div>
                    </el-col>
                    <el-col :span="6">
                        <div class="stat-box">
                            <div class="stat-value success">{{ submittedCount }}</div>
                            <div class="stat-label">已提交</div>
                        </div>
                    </el-col>
                    <el-col :span="6">
                        <div class="stat-box">
                            <div class="stat-value warning">{{ gradedCount }}</div>
                            <div class="stat-label">已批改</div>
                        </div>
                    </el-col>
                    <el-col :span="6">
                        <div class="stat-box">
                            <div class="stat-value danger">{{ averageScore }}</div>
                            <div class="stat-label">平均分</div>
                        </div>
                    </el-col>
                </el-row>

                <!-- 成绩分布图表 -->
                <div class="charts-container" v-if="submittedCount > 0">
                    <div id="scoreDistributionChart" style="height: 300px; margin-top: 20px;"></div>
                </div>
            </el-card>

            <!-- 搜索筛选栏 -->
            <div class="filter-container">
                <el-input 
                    placeholder="搜索学生姓名或学号" 
                    v-model="searchText"
                    prefix-icon="el-icon-search"
                    clearable
                    @input="handleSearch"
                    style="width: 250px; margin-right: 15px;">
                </el-input>

                <el-select v-model="statusFilter" placeholder="提交状态" style="width: 120px; margin-right: 15px;" @change="handleSearch">
                    <el-option label="全部" value="all"></el-option>
                    <el-option label="已提交" value="submitted"></el-option>
                    <el-option label="未提交" value="unsubmitted"></el-option>
                </el-select>

                <el-select v-model="gradedFilter" placeholder="批改状态" style="width: 120px; margin-right: 15px;" @change="handleSearch">
                    <el-option label="全部" value="all"></el-option>
                    <el-option label="已批改" value="graded"></el-option>
                    <el-option label="未批改" value="ungraded"></el-option>
                </el-select>

                <el-select v-model="sortOption" placeholder="排序方式" style="width: 150px;" @change="handleSearch">
                    <el-option label="学号升序" value="id-asc"></el-option>
                    <el-option label="学号降序" value="id-desc"></el-option>
                    <el-option label="成绩高到低" value="score-desc"></el-option>
                    <el-option label="成绩低到高" value="score-asc"></el-option>
                </el-select>

                <div style="float: right;">
                    <el-button type="primary" icon="el-icon-download" @click="exportResults">导出成绩</el-button>
                    <el-button type="success" icon="el-icon-refresh" @click="refreshData">刷新数据</el-button>
                </div>
            </div>

            <!-- 学生成绩表格 -->
            <el-table
                :data="filteredStudents"
                border
                stripe
                style="width: 100%; margin-top: 15px;"
                v-loading="tableLoading"
                :row-class-name="tableRowClassName">
                <el-table-column type="index" width="50" label="序号"></el-table-column>
                <el-table-column prop="userId" label="学号" width="120" sortable></el-table-column>
                <el-table-column label="学生信息" min-width="180">
                    <template slot-scope="scope">
                        <div class="student-info">
                            <el-avatar size="small" :src="scope.row.userAvatar || '/imgs/user/default.jpg'"></el-avatar>
                            <span style="margin-left: 10px">{{ scope.row.username }}</span>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column label="提交状态" width="100">
                    <template slot-scope="scope">
                        <el-tag :type="scope.row.submit ? 'success' : 'danger'" size="medium">
                            {{ scope.row.submit ? '已提交' : '未提交' }}
                        </el-tag>
                    </template>
                </el-table-column>

                <el-table-column label="批改状态" width="100">
                    <template slot-scope="scope">
                        <el-tag :type="scope.row.isCheckedBool ? 'success' : 'warning'" size="medium" v-if="scope.row.submit">
                            {{ scope.row.isCheckedBool ? '已批改' : '待批改' }}
                        </el-tag>
                        <span v-else>-</span>
                    </template>
                </el-table-column>

                <el-table-column label="客观题分数" width="120" sortable>
                    <template slot-scope="scope">
                        <span v-if="scope.row.submit">{{ scope.row.objectiveScore || '0' }}</span>
                        <span v-else>-</span>
                    </template>
                </el-table-column>

                <el-table-column label="总分" width="100" sortable>
                    <template slot-scope="scope">
                        <span v-if="scope.row.isCheckedBool" class="score-text">{{ scope.row.score }}</span>
                        <span v-else-if="scope.row.submit">待评分</span>
                        <span v-else>-</span>
                    </template>
                </el-table-column>

                <el-table-column label="提交时间" width="180">
                    <template slot-scope="scope">
                        <span v-if="scope.row.submit">{{ formatDateTime(scope.row.submitTime) }}</span>
                        <span v-else>-</span>
                    </template>
                </el-table-column>

                <el-table-column label="操作" width="200" fixed="right">
                    <template slot-scope="scope">
                        <el-button 
                            type="primary" 
                            size="mini" 
                            :disabled="!scope.row.submit"
                            @click="viewStudentDetail(scope.row)">
                            查看答卷
                        </el-button>
                        <el-button 
                            type="success" 
                            size="mini"
                            :disabled="!scope.row.submit || scope.row.isCheckedBool" 
                            @click="gradeExam(scope.row)">
                            评分
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>

            <!-- 分页 -->
            <el-pagination
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
                :current-page="currentPage"
                :page-sizes="[10, 20, 30, 50]"
                :page-size="pageSize"
                layout="total, sizes, prev, pager, next, jumper"
                :total="filteredStudents.length"
                style="margin-top: 15px; text-align: center;">
            </el-pagination>
        </div>

        <!-- 学生答卷详情对话框 -->
        <el-dialog :title="'学生答卷 - ' + (currentStudent ? currentStudent.username : '')" 
            :visible.sync="dialogVisible" 
            width="80%" 
            :before-close="handleDialogClose">
            <!-- 调试信息 -->
            <div v-if="currentStudent" class="debug-info" style="margin-bottom: 15px; padding: 10px; border: 1px dashed #ddd; background-color: #f9f9f9;">
                <p><strong>对话框状态:</strong> {{ dialogVisible ? '已打开' : '已关闭' }}</p>
                <p><strong>学生ID:</strong> {{ currentStudent.userId }}</p>
                <p><strong>学生姓名:</strong> {{ currentStudent.username }}</p>
                <p><strong>提交状态:</strong> {{ currentStudent.submit ? '已提交' : '未提交' }}</p>
            </div>

            <!-- 未提交答卷提示 -->
            <el-empty v-if="currentStudent && !currentStudent.submit" 
                description="该学生尚未提交答卷" 
                :image-size="200">
                <el-button type="info" @click="handleDialogClose">关闭</el-button>
            </el-empty>

            <!-- 已提交答卷内容 -->
            <div v-if="currentStudent && currentStudent.submit">
                <el-descriptions title="学生信息" :column="3" border>
                    <el-descriptions-item label="学号">{{ currentStudent.userId }}</el-descriptions-item>
                    <el-descriptions-item label="姓名">{{ currentStudent.username }}</el-descriptions-item>
                    <el-descriptions-item label="提交时间">{{ formatDateTime(currentStudent.submitTime) }}</el-descriptions-item>
                    <el-descriptions-item label="客观题分数">{{ currentStudent.objectiveScore || '0' }}</el-descriptions-item>
                    <el-descriptions-item label="总分">
                        <span v-if="currentStudent.isCheckedBool">{{ currentStudent.score }}</span>
                        <span v-else>待评分</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="状态">
                        <el-tag :type="currentStudent.isCheckedBool ? 'success' : 'warning'">
                            {{ currentStudent.isCheckedBool ? '已批改' : '待批改' }}
                        </el-tag>
                    </el-descriptions-item>
                </el-descriptions>

                <!-- 答案列表 -->
                <div class="answers-container">
                    <h3>答题记录 <small>(仅显示已提交的答案)</small></h3>

                    <el-collapse v-if="currentStudent.solutions && currentStudent.solutions.length > 0">
                        <el-collapse-item v-for="(solution, index) in currentStudent.solutions" :key="index">
                            <template slot="title">
                                <div class="solution-title">
                                    <span class="question-index">第 {{ index + 1 }} 题</span>
                                    <span class="question-type">
                                        <el-tag size="mini">
                                            {{ getQuestionTypeName(solution.subjectType) }}
                                        </el-tag>
                                    </span>
                                    <span class="question-score">
                                        <el-tag 
                                            size="mini" 
                                            :type="solution.score === getMaxScore(solution, index) ? 'success' : (solution.score > 0 ? 'warning' : 'danger')">
                                            得分: {{ solution.score || '0' }}分
                                        </el-tag>
                                    </span>
                                </div>
                            </template>

                            <div class="solution-content">
                                <!-- 题目内容 -->
                                <div class="question-content" v-if="subjects[index]">
                                    <div class="content-title">题目内容:</div>
                                    <div class="content-text">
                                        <div v-if="solution.subjectType === 1">{{ subjects[index].choice.content }}</div>
                                        <div v-else-if="solution.subjectType === 2">{{ subjects[index].filling.content }}</div>
                                        <div v-else-if="solution.subjectType === 3">{{ subjects[index].trueFalse.content }}</div>
                                        <div v-else-if="solution.subjectType === 4">{{ subjects[index].questionAnswer.content }}</div>
                                    </div>

                                    <!-- 选择题选项 -->
                                    <div class="options" v-if="solution.subjectType === 1 && subjects[index].choice.options">
                                        <div v-for="(option, idx) in subjects[index].choice.options" :key="idx" 
                                            :class="['option', 
                                                    isOptionSelected(solution.answer, idx) ? 'selected' : '',
                                                    isCorrectOption(subjects[index].choice.answers, idx) ? 'correct' : '']">
                                            <span class="option-letter">{{ getOptionLetter(idx) }}</span>
                                            <span class="option-content">{{ option }}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- 学生答案 -->
                                <div class="student-answer">
                                    <div class="content-title">学生答案:</div>
                                    <div class="answer-text" v-if="solution.subjectType === 1">
                                        {{ formatChoiceAnswer(solution.answer) }}
                                    </div>
                                    <div class="answer-text" v-else-if="solution.subjectType === 2">
                                        {{ solution.answer || '(未作答)' }}
                                    </div>
                                    <div class="answer-text" v-else-if="solution.subjectType === 3">
                                        {{ solution.answer === 'T' ? '正确' : '错误' }}
                                    </div>
                                    <div class="answer-text" v-else-if="solution.subjectType === 4">
                                        <pre>{{ solution.answer || '(未作答)' }}</pre>
                                    </div>
                                </div>

                                <!-- 参考答案 -->
                                <div class="standard-answer">
                                    <div class="content-title">参考答案:</div>
                                    <div v-if="solution.subjectType === 1 && subjects[index] && subjects[index].choice">
                                        {{ formatChoiceAnswer(subjects[index].choice.answers) }}
                                    </div>
                                    <div v-else-if="solution.subjectType === 2 && subjects[index] && subjects[index].filling && subjects[index].filling.answers">
                                        {{ subjects[index].filling.answers.join('、') }}
                                    </div>
                                    <div v-else-if="solution.subjectType === 3 && subjects[index] && subjects[index].trueFalse">
                                        {{ subjects[index].trueFalse.answer === 'T' ? '正确' : '错误' }}
                                    </div>
                                    <div v-else-if="solution.subjectType === 4 && subjects[index] && subjects[index].questionAnswer">
                                        <pre>{{ subjects[index].questionAnswer.answer }}</pre>
                                    </div>
                                    <div v-else>
                                        (答案未找到)
                                    </div>
                                </div>
                            </div>
                        </el-collapse-item>
                    </el-collapse>

                    <div v-else class="no-solutions">
                        该学生尚未提交任何答案
                    </div>
                </div>
            </div>

            <span slot="footer" class="dialog-footer">
                <el-button type="primary" @click="dialogVisible = false">关闭</el-button>
            </span>
        </el-dialog>
    </div>
</template>

<script>
// 引入echarts
import * as echarts from 'echarts';

export default {
    name: "AdminExamDetail",
    data() {
        return {
            loading: false,
            tableLoading: false,
            examId: null,
            courseId: null,
            examTitle: "考试成绩详情",
            exam: null,

            // 学生数据
            allStudents: [],
            filteredStudents: [],
            subjects: [],

            // 统计数据
            totalStudents: 0,
            submittedCount: 0,
            gradedCount: 0,
            averageScore: "0.0",

            // 分页
            currentPage: 1,
            pageSize: 10,

            // 筛选
            searchText: "",
            statusFilter: "all",  // all, submitted, unsubmitted
            gradedFilter: "all",  // all, graded, ungraded
            sortOption: "id-asc", // id-asc, id-desc, score-desc, score-asc

            // 图表
            scoreDistributionChart: null,

            // 学生详情对话框
            dialogVisible: false,
            currentStudent: null
        };
    },
    created() {
        // 获取路由参数
        this.examId = this.$route.params.examId;
        this.courseId = this.$route.params.courseId;

        if (!this.examId) {
            this.$message.error("考试ID不存在，请返回考试列表重新选择");
            this.goBack();
            return;
        }

        this.loadExamData();
    },
    mounted() {
        window.addEventListener('resize', this.resizeChart);
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.resizeChart);
        if (this.scoreDistributionChart) {
            this.scoreDistributionChart.dispose();
        }
    },
    methods: {
        // 加载考试数据
        loadExamData() {
            this.loading = true;

            // 加载考试基本信息
            this.$axios.post("/Exam/getExamById", { examId: this.examId }).then(res => {
                if (res.data.flag) {
                    this.exam = res.data.data;
                    this.examTitle = this.exam.title + " - 成绩详情";

                    // 获取标准答案
                    this.getSubjects();

                    // 获取学生答卷信息
                    this.getStudentExams();
                } else {
                    this.$message.error("获取考试信息失败");
                }
                this.loading = false;
            }).catch(() => {
                this.$message.error("获取考试信息失败");
                this.loading = false;
            });
        },

        // 获取试题数据
        getSubjects() {
            this.$axios.post("/Paper/getPaperByExamId", { examId: this.examId }).then(res => {
                if (res.data.flag) {
                    this.subjects = res.data.data;
                } else {
                    this.$message.error("获取试题信息失败");
                }
            });
        },

        // 获取学生答卷
        getStudentExams() {
            this.tableLoading = true;
            this.$axios.post("/Answer/getAllUserAnswer", { examId: this.examId }).then(res => {
                if (res.data.flag) {
                    this.allStudents = res.data.data || [];
                    this.calculateStats();
                    this.applyFilters();
                    this.$nextTick(() => {
                        this.initScoreDistributionChart();
                    });
                } else {
                    this.$message.error("获取学生答卷失败");
                }
                this.tableLoading = false;
            }).catch(() => {
                this.$message.error("获取学生答卷失败");
                this.tableLoading = false;
            });
        },

        // 计算统计数据
        calculateStats() {
            this.totalStudents = this.allStudents.length;

            let submitted = 0;
            let graded = 0;
            let totalScore = 0;

            this.allStudents.forEach(student => {
                if (student.submit) {
                    submitted++;

                    if (student.isCheckedBool) {
                        graded++;
                        totalScore += parseFloat(student.score || 0);
                    }
                }
            });

            this.submittedCount = submitted;
            this.gradedCount = graded;
            this.averageScore = graded > 0 ? (totalScore / graded).toFixed(1) : "0.0";
        },

        // 筛选和排序
        applyFilters() {
            let filtered = [...this.allStudents];

            // 应用搜索过滤
            if (this.searchText) {
                const searchLower = this.searchText.toLowerCase();
                filtered = filtered.filter(student => 
                    student.username.toLowerCase().includes(searchLower) || 
                    student.userId.toLowerCase().includes(searchLower)
                );
            }

            // 应用提交状态过滤
            if (this.statusFilter !== "all") {
                filtered = filtered.filter(student => 
                    (this.statusFilter === "submitted" && student.submit) ||
                    (this.statusFilter === "unsubmitted" && !student.submit)
                );
            }

            // 应用批改状态过滤
            if (this.gradedFilter !== "all") {
                filtered = filtered.filter(student => 
                    (this.gradedFilter === "graded" && student.isCheckedBool) ||
                    (this.gradedFilter === "ungraded" && !student.isCheckedBool && student.submit)
                );
            }

            // 应用排序
            switch (this.sortOption) {
                case "id-asc":
                    filtered.sort((a, b) => a.userId.localeCompare(b.userId));
                    break;
                case "id-desc":
                    filtered.sort((a, b) => b.userId.localeCompare(a.userId));
                    break;
                case "score-desc":
                    filtered.sort((a, b) => {
                        // 未批改的放后面
                        if (!a.isCheckedBool && b.isCheckedBool) return 1;
                        if (a.isCheckedBool && !b.isCheckedBool) return -1;
                        // 未提交的放最后
                        if (!a.submit && b.submit) return 1;
                        if (a.submit && !b.submit) return -1;
                        // 按分数排序
                        return parseFloat(b.score || 0) - parseFloat(a.score || 0);
                    });
                    break;
                case "score-asc":
                    filtered.sort((a, b) => {
                        // 未批改的放后面
                        if (!a.isCheckedBool && b.isCheckedBool) return 1;
                        if (a.isCheckedBool && !b.isCheckedBool) return -1;
                        // 未提交的放最后
                        if (!a.submit && b.submit) return 1;
                        if (a.submit && !b.submit) return -1;
                        // 按分数排序
                        return parseFloat(a.score || 0) - parseFloat(b.score || 0);
                    });
                    break;
            }

            this.filteredStudents = filtered;
        },

        // 初始化分数分布图表
        initScoreDistributionChart() {
            // 如果没有数据，不绘制图表
            if (!this.submittedCount || !this.gradedCount) {
                return;
            }

            // 获取已批改的学生分数
            const gradedStudents = this.allStudents.filter(student => 
                student.submit && student.isCheckedBool
            );

            if (!gradedStudents.length) {
                return;
            }

            // 计算分数区间
            const scoreRanges = [
                { min: 0, max: 59, count: 0, label: '不及格(<60)' },
                { min: 60, max: 69, count: 0, label: '及格(60-69)' },
                { min: 70, max: 79, count: 0, label: '中等(70-79)' },
                { min: 80, max: 89, count: 0, label: '良好(80-89)' },
                { min: 90, max: 100, count: 0, label: '优秀(90-100)' }
            ];

            // 统计各分数段人数
            gradedStudents.forEach(student => {
                const score = parseFloat(student.score || 0);
                for (const range of scoreRanges) {
                    if (score >= range.min && score <= range.max) {
                        range.count++;
                        break;
                    }
                }
            });

            // 准备图表数据
            const chartDom = document.getElementById('scoreDistributionChart');
            if (!chartDom) return;

            // 创建或重用图表实例
            if (this.scoreDistributionChart) {
                this.scoreDistributionChart.dispose();
            }
            this.scoreDistributionChart = echarts.init(chartDom);

            const option = {
                title: {
                    text: '分数分布统计',
                    left: 'center'
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'shadow'
                    },
                    formatter: function(params) {
                        const data = params[0].data;
                        return `${params[0].name}：${data}人，占比${((data / gradedStudents.length) * 100).toFixed(2)}%`;
                    }
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '3%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: scoreRanges.map(range => range.label),
                    axisLabel: {
                        interval: 0,
                        rotate: 30
                    }
                },
                yAxis: {
                    type: 'value',
                    name: '人数',
                    minInterval: 1
                },
                series: [
                    {
                        name: '学生数',
                        type: 'bar',
                        data: scoreRanges.map(range => range.count),
                        itemStyle: {
                            color: function(params) {
                                const colors = ['#F56C6C', '#E6A23C', '#67C23A', '#409EFF', '#9B59B6'];
                                return colors[params.dataIndex];
                            }
                        },
                        label: {
                            show: true,
                            position: 'top',
                            formatter: function(params) {
                                return params.data;
                            }
                        }
                    }
                ]
            };

            this.scoreDistributionChart.setOption(option);
        },

        // 重置图表大小
        resizeChart() {
            if (this.scoreDistributionChart) {
                this.scoreDistributionChart.resize();
            }
        },

        // 处理搜索
        handleSearch() {
            this.currentPage = 1;
            this.applyFilters();
        },

        // 处理分页大小变化
        handleSizeChange(val) {
            this.pageSize = val;
        },

        // 处理当前页变化
        handleCurrentChange(val) {
            this.currentPage = val;
        },

        // 查看学生答卷详情（使用对话框显示）
        viewStudentDetail(student) {
            console.log("点击查看学生答卷按钮:", student);

            // 检查学生对象是否有效
            if (!student) {
                console.error("学生对象为空");
                this.$message.error("无法获取学生信息");
                return;
            }

            // 复制学生对象，避免引用问题
            this.currentStudent = JSON.parse(JSON.stringify(student));

            // 显示对话框
            this.$nextTick(() => {
                this.dialogVisible = true;
                console.log("对话框应该已显示，dialogVisible =", this.dialogVisible);
                console.log("当前学生信息:", this.currentStudent);
            });
        },

        // 评分功能已移除，改为页面跳转

        // 处理对话框关闭
        handleDialogClose() {
            this.dialogVisible = false;
            this.currentStudent = null;
        },

        // 导出成绩
        exportResults() {
            this.$message({
                message: '成绩导出功能暂未实现，将在后续版本中添加',
                type: 'info'
            });
        },

        // 刷新数据
        refreshData() {
            this.loadExamData();
        },

        // 返回上一页
        goBack() {
            this.$router.go(-1);
        },

        // 获取考试状态文本
        getStatusText(exam) {
            const now = new Date();
            const beginDate = new Date(exam.beginDate);
            const endDate = new Date(exam.endDate);

            if (now < beginDate) return '未开始';
            if (now > endDate) return '已结束';
            return '进行中';
        },

        // 获取考试状态标签类型
        getStatusType(exam) {
            const now = new Date();
            const beginDate = new Date(exam.beginDate);
            const endDate = new Date(exam.endDate);

            if (now < beginDate) return 'info';
            if (now > endDate) return 'danger';
            return 'success';
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
        },

        // 表格行样式
        tableRowClassName({row}) {
            if (!row.submit) {
                return 'unsubmitted-row';
            }
            return '';
        },

        // 获取题型名称
        getQuestionTypeName(type) {
            switch (type) {
                case 1: return '选择题';
                case 2: return '填空题';
                case 3: return '判断题';
                case 4: return '简答题';
                default: return '未知题型';
            }
        },

        // 格式化选择题答案
        formatChoiceAnswer(answer) {
            if (!answer) return '(未作答)';

            try {
                // 将英文字母转换为选项标签
                const options = answer.split(',').map(opt => {
                    // 将数字索引转换为字母选项
                    const index = parseInt(opt);
                    if (!isNaN(index)) {
                        return String.fromCharCode(65 + index); // A, B, C, D...
                    }
                    return opt;
                });

                return options.join(', ');
            } catch (error) {
                console.error("格式化选择题答案出错:", error, "答案值:", answer);
                return '(格式化错误)';
            }
        },

        // 获取选项字母
        getOptionLetter(index) {
            return String.fromCharCode(65 + index); // A, B, C, D...
        },

        // 检查选项是否被选择
        isOptionSelected(answer, optionIndex) {
            if (!answer) return false;
            const answers = answer.split(',');
            return answers.includes(optionIndex.toString());
        },

        // 检查是否是正确选项
        isCorrectOption(answers, optionIndex) {
            if (!answers) return false;
            const correctAnswers = answers.split(',');
            return correctAnswers.includes(optionIndex.toString());
        },

        // 获取题目最大分值
        getMaxScore(solution, index) {
            if (!this.subjects[index]) return 0;

            switch(solution.subjectType) {
                case 1: return this.subjects[index].choice?.score || 0;
                case 2: return this.subjects[index].filling?.score || 0;
                case 3: return this.subjects[index].trueFalse?.score || 0;
                case 4: return this.subjects[index].questionAnswer?.score || 0;
                default: return 0;
            }
        },

        // 处理对话框关闭
        handleDialogClose() {
            this.dialogVisible = false;
            this.currentStudent = null;
            console.log("对话框已关闭");
        }
    }
}
</script>

<style scoped>
.admin-exam-detail {
    padding: 20px;
}

.page-header {
    margin-bottom: 20px;
}

.exam-info-card {
    margin-bottom: 20px;
}

.exam-header h2 {
    margin-top: 0;
    margin-bottom: 10px;
}

.exam-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    color: #606266;
}

.exam-description {
    margin-top: 15px;
    padding: 15px;
    background-color: #f5f7fa;
    border-radius: 4px;
}

.stats-card {
    margin-bottom: 20px;
}

.stat-box {
    text-align: center;
    padding: 15px 0;
}

.stat-value {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 5px;
}

.stat-value.primary { color: #409EFF; }
.stat-value.success { color: #67C23A; }
.stat-value.warning { color: #E6A23C; }
.stat-value.danger { color: #F56C6C; }

.stat-label {
    color: #606266;
    font-size: 14px;
}

.filter-container {
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
}

.student-info {
    display: flex;
    align-items: center;
}

.score-text {
    font-weight: bold;
}

.unsubmitted-row {
    background-color: #fafafa;
    color: #909399;
}

/* 学生答卷详情对话框样式 */
.answers-container {
    margin-top: 20px;
}

.solution-title {
    display: flex;
    align-items: center;
}

.question-index {
    font-weight: bold;
    margin-right: 10px;
}

.question-type {
    margin-right: 10px;
}

.solution-content {
    padding: 15px;
    background-color: #f5f7fa;
    border-radius: 4px;
    margin-top: 10px;
}

.question-content, .student-answer, .standard-answer {
    margin-bottom: 15px;
}

.content-title {
    font-weight: bold;
    margin-bottom: 5px;
    color: #303133;
}

.content-text, .answer-text {
    white-space: pre-wrap;
    word-break: break-all;
}

.standard-answer .content-title {
    color: #67C23A;
}

.options {
    margin-top: 10px;
}

.option {
    margin-bottom: 5px;
    padding: 5px 10px;
    border-radius: 4px;
    background-color: #ffffff;
}

.option.selected {
    background-color: #ecf5ff;
    border: 1px solid #d9ecff;
}

.option.correct {
    background-color: #f0f9eb;
    border: 1px solid #e1f3d8;
}

.option-letter {
    font-weight: bold;
    margin-right: 10px;
}

.no-solutions {
    text-align: center;
    padding: 30px;
    color: #909399;
    font-style: italic;
}

pre {
    white-space: pre-wrap;
    word-break: break-all;
    background-color: #f5f7fa;
    padding: 10px;
    border-radius: 4px;
    margin: 0;
}
</style>