<template>
    <div>
        <!-- 返回按钮和课程信息 -->
        <el-page-header @back="goBack" :content="courseName + ' - 考试列表'">
        </el-page-header>

        <el-divider></el-divider>

        <!-- 功能菜单 -->
        <el-row style="margin-top: 20px">
            <el-col :span="8">
                <el-input
                    placeholder="搜索考试名称"
                    v-model="searchExamTitle"
                    clearable
                    @clear="getExamList"
                    prefix-icon="el-icon-search">
                    <el-button slot="append" icon="el-icon-search" @click="getExamList"></el-button>
                </el-input>
            </el-col>
            <el-col :span="8" :offset="8" style="text-align: right;">
                <el-select v-model="examTypeFilter" placeholder="考试类型" size="medium" @change="getExamList">
                    <el-option label="全部类型" :value="0"></el-option>
                    <el-option label="小测" :value="1"></el-option>
                    <el-option label="作业" :value="2"></el-option>
                    <el-option label="考试" :value="3"></el-option>
                </el-select>
                <el-button type="primary" icon="el-icon-refresh" @click="refreshData" style="margin-left: 10px;">刷新</el-button>
            </el-col>
        </el-row>

        <!-- 考试列表 -->
        <el-card style="margin-top: 20px">
            <div v-if="loading" style="text-align: center; padding: 40px;">
                <el-skeleton :rows="6" animated/>
            </div>
            <div v-else>
                <template v-if="examList.length > 0">
                    <el-table
                        :data="examList"
                        border
                        style="width: 100%"
                        :row-class-name="tableRowClassName">
                        <el-table-column prop="examId" label="ID" width="60"></el-table-column>
                        <el-table-column prop="title" label="考试名称" min-width="180"></el-table-column>
                        <el-table-column label="类型" width="80">
                            <template slot-scope="scope">
                                <el-tag :type="getTypeTagType(scope.row.type)">{{ getTypeText(scope.row.type) }}</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="状态" width="100">
                            <template slot-scope="scope">
                                <el-tag :type="getStatusType(scope.row)">{{ getStatusText(scope.row) }}</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="参与学生" width="100">
                            <template slot-scope="scope">
                                <span v-if="scope.row.studentCount !== undefined">
                                    <el-tag type="info">{{ scope.row.studentCount }}</el-tag>
                                </span>
                                <span v-else>
                                    <el-button type="text" size="mini" @click.stop="loadExamDetails(scope.row)">加载</el-button>
                                </span>
                            </template>
                        </el-table-column>
                        <el-table-column label="已批改/已提交" width="120">
                            <template slot-scope="scope">
                                <span v-if="scope.row.gradedCount !== undefined">
                                    <el-progress 
                                        :percentage="scope.row.studentCount > 0 ? Math.round((scope.row.gradedCount / scope.row.studentCount) * 100) : 0" 
                                        :status="scope.row.gradedCount === scope.row.studentCount && scope.row.studentCount > 0 ? 'success' : ''">
                                    </el-progress>
                                    {{ scope.row.gradedCount }}/{{ scope.row.studentCount }}
                                </span>
                                <span v-else>
                                    <el-button type="text" size="mini" @click.stop="loadExamDetails(scope.row)">加载</el-button>
                                </span>
                            </template>
                        </el-table-column>
                        <el-table-column label="平均分" width="100">
                            <template slot-scope="scope">
                                <span v-if="scope.row.averageScore !== undefined">
                                    {{ scope.row.averageScore !== null ? scope.row.averageScore.toFixed(1) : '暂无' }}
                                </span>
                                <span v-else>
                                    <el-button type="text" size="mini" @click.stop="loadExamDetails(scope.row)">加载</el-button>
                                </span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="createTime" label="创建时间" width="140"></el-table-column>
                        <el-table-column prop="beginDate" label="开始时间" width="140"></el-table-column>
                        <el-table-column prop="endDate" label="结束时间" width="140"></el-table-column>
                        <el-table-column label="操作" width="180" fixed="right">
                            <template slot-scope="scope">
                                <el-button size="mini" type="primary" @click.stop="viewExamInfo(scope.row)">查看成绩</el-button>
                                <el-button size="mini" type="success" @click.stop="exportResults(scope.row)">导出成绩</el-button>
                            </template>
                        </el-table-column>
                    </el-table>

                    <!-- 分页组件 -->
                    <el-pagination
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                        :current-page="currentPage"
                        :page-sizes="[10, 20, 30, 50]"
                        :page-size="pageSize"
                        layout="total, sizes, prev, pager, next, jumper"
                        :total="totalCount"
                        style="margin-top: 20px; text-align: right;">
                    </el-pagination>
                </template>
                <el-empty v-else description="暂无考试数据"></el-empty>
            </div>
        </el-card>
    </div>
</template>

<script>
export default {
    name: "AdmCourseExams",
    data() {
        return {
            // 课程信息
            courseId: null,
            courseName: "",
            // 考试列表
            examList: [],
            // 搜索条件
            searchExamTitle: "",
            examTypeFilter: 0, // 0-全部，1-小测，2-作业，3-考试
            // 分页信息
            currentPage: 1,
            pageSize: 10,
            totalCount: 0,
            // 加载状态
            loading: false
        }
    },
    created() {
        // 获取路由参数
        this.courseId = this.$route.params.courseId;
        this.courseName = this.$route.params.courseName || "未知课程";

        if (!this.courseId) {
            this.$message.error("课程ID不存在，请返回课程列表重新选择");
            this.goBack();
            return;
        }

        this.getExamList();
    },
    methods: {
        // 返回课程列表
        goBack() {
            this.$router.go(-1); // 返回上一页
        },

        // 获取考试类型标签样式
        getTypeTagType(type) {
            switch (type) {
                case 1: return "info";    // 小测
                case 2: return "warning"; // 作业
                case 3: return "danger";  // 考试
                default: return "info";
            }
        },

        // 获取考试类型文本
        getTypeText(type) {
            switch (type) {
                case 1: return "小测";
                case 2: return "作业";
                case 3: return "考试";
                default: return "未知";
            }
        },

        // 获取考试列表 - 基于 th_exam 表
        getExamList() {
            this.loading = true;

            // 构造请求参数
            const params = {
                courseId: this.courseId,
                title: this.searchExamTitle,
                type: this.examTypeFilter > 0 ? this.examTypeFilter : null,
                pageSize: this.pageSize,
                currentPage: this.currentPage
            };

            // 使用与学生端相同的API调用方式
            console.log("开始获取考试列表，参数:", params);
            this.$axios.post("/Exam/getExam", params).then((res) => {
                this.loading = false;
                if (res.data.flag) {
                    this.examList = res.data.data.records;
                    this.totalCount = res.data.data.total;
                    this.currentPage = res.data.data.current;
                    this.pageSize = res.data.data.size;

                    // 格式化日期
                    this.examList.forEach(exam => {
                        exam.createTime = this.formatDateTime(exam.createTime);
                        exam.beginDate = this.formatDateTime(exam.beginDate);
                        exam.endDate = this.formatDateTime(exam.endDate);

                        // 初始化统计数据
                        exam.studentCount = undefined;
                        exam.gradedCount = undefined;
                        exam.averageScore = undefined;
                    });

                    // 批量获取考试详情
                    this.batchLoadExamDetails();
                } else {
                    console.error("获取考试列表失败:", res.data);
                    this.$message({
                        message: "获取考试列表失败，正在使用模拟数据",
                        type: "warning",
                        duration: 3000
                    });

                    // 使用模拟数据作为后备
                    this.useMockExamData();
                }
            }).catch((err) => {
                console.error("考试列表请求出错:", err);
                this.loading = false;
                this.$message({
                    message: "网络请求失败，正在使用模拟数据",
                    type: "warning",
                    duration: 3000
                });

                // 使用模拟数据作为后备
                this.useMockExamData();
            });
        },

        // 批量加载考试详情
        batchLoadExamDetails() {
            // 每次最多加载前10个考试的详情
            const examsToBatch = this.examList.slice(0, 10);

            examsToBatch.forEach(exam => {
                this.loadExamDetails(exam, false);
            });
        },

        // 加载单个考试的详细信息
        loadExamDetails(exam, showLoading = true) {
            if (showLoading) {
                this.$set(exam, 'loading', true);
            }

            // 获取考试的学生答题情况
            this.$axios.post("/Answer/getAllUserAnswer", { examId: exam.examId }).then(res => {
                if (res.data.flag && res.data.data) {
                    const students = res.data.data;

                    // 计算统计信息
                    let submittedCount = 0;
                    let gradedCount = 0;
                    let totalScore = 0;
                    let gradedTotalScore = 0;

                    students.forEach(student => {
                        if (student.submit) {
                            submittedCount++;
                        }

                        if (student.isCheckedBool) {
                            gradedCount++;
                            gradedTotalScore += parseFloat(student.score || 0);
                        }

                        if (student.score) {
                            totalScore += parseFloat(student.score || 0);
                        }
                    });

                    // 更新考试信息
                    this.$set(exam, 'studentCount', submittedCount);
                    this.$set(exam, 'gradedCount', gradedCount);
                    this.$set(exam, 'averageScore', gradedCount > 0 ? gradedTotalScore / gradedCount : null);

                    // 存储学生详情数据，避免重复请求
                    this.$set(exam, 'studentDetails', students);
                }

                if (showLoading) {
                    this.$set(exam, 'loading', false);
                }
            }).catch(() => {
                if (showLoading) {
                    this.$set(exam, 'loading', false);
                    this.$message.error("加载考试详情失败");
                }
            });
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

        // 分页事件处理
        handleSizeChange(size) {
            this.pageSize = size;
            this.getExamList();
        },

        handleCurrentChange(page) {
            this.currentPage = page;
            this.getExamList();
        },

        // 表格行样式
        tableRowClassName({row, rowIndex}) {
            if (rowIndex % 2 === 0) {
                return 'row-even';
            } else {
                return 'row-odd';
            }
        },

        // 查看考试详情和学生成绩 - 使用管理员专用的考试详情页面
        viewExamInfo(exam) {
            this.$router.push({
                name: 'AdminExamDetail',
                params: {
                    examId: exam.examId,
                    courseId: this.courseId,
                    courseName: this.courseName
                }
            });
        },

        // 导出成绩
        exportResults(exam) {
            this.$message.info("正在准备导出数据...");

            // 如果已经加载了学生详情，直接使用
            if (exam.studentDetails) {
                this.generateCsv(exam, exam.studentDetails);
                return;
            }

            // 否则重新获取学生答题数据
            this.$axios.post("/Answer/getAllUserAnswer", {examId: exam.examId}).then(res => {
                if (res.data.flag && res.data.data) {
                    const students = res.data.data;
                    this.generateCsv(exam, students);
                } else {
                    this.$message.error("获取考试数据失败");
                }
            }).catch(() => {
                this.$message.error("导出成绩失败");
            });
        },

        // 生成CSV文件并下载
        generateCsv(exam, students) {
            // 准备CSV数据
            let csvContent = "学号,姓名,总分,客观题分数,主观题分数,提交状态,评分状态,提交时间\n";

            students.forEach(student => {
                const submitStatus = student.submit ? "已提交" : "未提交";
                const gradeStatus = student.isCheckedBool ? "已评分" : "未评分";
                const submitTime = student.submit ? this.formatDateTime(student.submitTime) : "未提交";
                const subjectiveScore = student.score - (student.objectiveScore || 0);

                csvContent += `${student.userId},${student.username},${student.score || 0},${student.objectiveScore || 0},${subjectiveScore || 0},${submitStatus},${gradeStatus},${submitTime}\n`;
            });

            // 创建下载链接
            const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `${this.courseName}_${exam.title}_成绩表.csv`);
            document.body.appendChild(link);

            // 触发下载
            link.click();
            document.body.removeChild(link);

            this.$message.success("成绩表导出成功");
        },

        // 格式化日期时间
        formatDateTime(dateTime) {
            if (!dateTime) return '';

            const date = new Date(dateTime);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');

            return `${year}-${month}-${day} ${hour}:${minute}`;
        },

        // 刷新数据
        refreshData() {
            this.searchExamTitle = "";
            this.examTypeFilter = 0;
            this.currentPage = 1;
            this.getExamList();
            this.$message.success("数据已刷新");
        }
    }
}
</script>

<style scoped>
.el-table .row-even {
    background-color: #fafafa;
}

.el-table .row-odd {
    background-color: #ffffff;
}

.el-table .el-button--mini {
    padding: 5px 10px;
}

.el-card {
    margin-bottom: 20px;
}
</style>