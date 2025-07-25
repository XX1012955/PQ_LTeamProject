const express = require('express');
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

// 简化版的考试生成API
router.post('/simple-generate-exam', async (req, res) => {
    try {
        const { title, questions } = req.body;
        
        console.log('收到简化版考试生成请求');
        console.log(`标题: ${title}`);
        console.log(`题目数量: ${questions ? questions.length : 0}`);
        
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            console.error('没有提供有效的题目数据');
            return res.status(400).json({ success: false, error: '没有提供有效的题目数据' });
        }
        
        // 连接数据库
        console.log('连接数据库...');
        const connection = await mysql.createConnection(dbConfig);
        
        try {
            await connection.beginTransaction();
            console.log('开始事务');
            
            // 创建考试记录
            const now = new Date();
            const beginDate = now.toISOString().slice(0, 19).replace('T', ' ');
            const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
            
            console.log('创建考试记录...');
            const [examResult] = await connection.execute(
                'INSERT INTO th_exam (course_id, author_id, type, title, detail, not_order, begin_date, end_date, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    7, // 默认课程ID
                    'stu023', // 默认作者ID
                    3, // 默认考试类型
                    title || `AI生成考试 - ${new Date().toISOString().slice(0, 10)}`,
                    '自动生成的考试',
                    1,
                    beginDate,
                    endDate,
                    now.toISOString().slice(0, 19).replace('T', ' ')
                ]
            );
            
            const examId = examResult.insertId;
            console.log(`考试记录创建成功，ID: ${examId}`);
            
            // 处理每个题目
            console.log('开始处理题目...');
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                // 使用时间戳+索引作为题目ID，避免ID冲突
                const subjectId = parseInt(`${Date.now().toString().slice(-6)}${i + 1}`);
                
                console.log(`处理题目 ${i + 1}/${questions.length}, ID: ${subjectId}`);
                console.log(`题目内容: ${question.content.substring(0, 30)}...`);
                
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
                    console.log(`  选项 ${option.letter}: ${option.content.substring(0, 20)}..., 是否正确: ${isAnswer}`);
                }
                
                // 将题目添加到试卷
                await connection.execute(
                    'INSERT INTO th_paper (exam_id, subject_type, subject_id, subject_num) VALUES (?, ?, ?, ?)',
                    [examId, 1, subjectId, i + 1]
                );
            }
            
            await connection.commit();
            console.log('事务提交成功');
            
            res.json({
                success: true,
                examId: examId,
                message: '考试生成成功'
            });
            
            console.log(`考试 ${examId} 创建完成，包含 ${questions.length} 个题目`);
        } catch (error) {
            await connection.rollback();
            console.error('事务回滚，错误:', error);
            throw error;
        } finally {
            await connection.end();
            console.log('数据库连接已关闭');
        }
    } catch (error) {
        console.error('生成考试出错:', error);
        res.status(500).json({
            success: false,
            error: '生成考试失败: ' + error.message
        });
    }
});

module.exports = router;