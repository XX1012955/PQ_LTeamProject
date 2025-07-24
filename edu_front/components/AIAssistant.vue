<template>
  <div class="ai-assistant">
    <div class="chat-container">
      <div class="chat-messages" ref="messageContainer">
        <div v-for="(message, index) in messages" :key="index" 
             :class="['message', message.type]">
          <div class="message-content">
            <div class="avatar">
              <i :class="message.type === 'user' ? 'el-icon-user' : 'el-icon-service'"></i>
            </div>
            <div class="text">
              <div class="message-text">{{ message.content }}</div>
              <div class="message-time">{{ new Date().toLocaleTimeString() }}</div>
            </div>
          </div>
        </div>
        <div v-if="loading" class="message assistant">
          <div class="message-content">
            <div class="avatar">
              <i class="el-icon-service"></i>
            </div>
            <div class="text">
              <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="chat-input">
        <el-input
          v-model="userInput"
          type="textarea"
          :rows="3"
          placeholder="请输入您的问题..."
          @keyup.enter.native="sendMessage"
          resize="none"
        ></el-input>
        <el-button type="primary" @click="sendMessage" :loading="loading" class="send-button">
          <i class="el-icon-s-promotion"></i> 发送
        </el-button>
      </div>
    </div>
    <div class="scroll-to-bottom" @click="scrollToBottom">
      <i class="el-icon-arrow-down"></i>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'AIAssistant',
  data() {
    return {
      messages: [],
      userInput: '',
      loading: false,
      apiKey: 'sk-e969fcd707b74db69cdd56605a6fa205',
      apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
      systemMessage: {
        role: "system",
        content: "你是一个智能助手，可以帮助用户解答问题。请用简洁、专业的方式回答。"
      }
    }
  },
  mounted() {
    // 添加欢迎消息
    this.messages.push({
      type: 'assistant',
      content: '欢迎访问在线学习平台，有什么可以帮助你的吗？'
    });
  },
  watch: {
    // 监听消息数组变化
    messages: {
      handler() {
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      },
      deep: true
    }
  },
  methods: {
    exitChat() {
      this.$emit('close');
      this.$router.go(-1);
    },
    async sendMessage() {
      if (!this.userInput.trim()) return;
      
      // 添加用户消息
      this.messages.push({
        type: 'user',
        content: this.userInput
      });

      const userMessage = this.userInput;
      this.userInput = '';
      this.loading = true;

      try {
        // 创建axios实例，设置基础配置
        const instance = axios.create({
          timeout: 60000, // 增加超时时间到30秒
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        // 添加请求拦截器
        instance.interceptors.request.use(config => {
          // 在发送请求之前做些什么
          this.loading = true;
          return config;
        });

        // 添加响应拦截器
        instance.interceptors.response.use(
          response => {
            this.loading = false;
            return response;
          },
          error => {
            this.loading = false;
            if (error.code === 'ECONNABORTED') {
              this.$message.error('请求超时，正在重试...');
              // 重试请求
              return instance.request(error.config);
            }
            return Promise.reject(error);
          }
        );

        const response = await instance.post(this.apiEndpoint, {
          model: "deepseek-chat",
          messages: [
            this.systemMessage,
            ...this.messages.slice(-4).map(msg => ({
              role: msg.type === 'user' ? 'user' : 'assistant',
              content: msg.content
            }))
          ],
          temperature: 0.7,
          max_tokens: 1000,
          stream: false,
          presence_penalty: 0.6,
          frequency_penalty: 0.6,
          top_p: 0.9,
          n: 1
        });

        if (response.data && response.data.choices && response.data.choices[0]) {
          // 添加AI回复
          const aiResponse = response.data.choices[0].message.content;
          this.messages.push({
            type: 'assistant',
            content: aiResponse
          });
          
          // 强制重新计算布局并滚动
          this.$nextTick(() => {
            const container = this.$refs.messageContainer;
            if (container) {
              // 先滚动到底部
              container.scrollTop = container.scrollHeight;
              
              // 强制重绘
              container.style.display = 'none';
              container.offsetHeight; // 触发重绘
              container.style.display = 'block';
              
              // 再次滚动到底部确保内容完全显示
              setTimeout(() => {
                container.scrollTop = container.scrollHeight;
              }, 0);
            }
          });
        } else {
          throw new Error('Invalid response format');
        }
      } catch (error) {
        console.error('API Error:', error);
        let errorMessage = '获取AI回复失败，请稍后重试';
        
        if (error.response) {
          switch (error.response.status) {
            case 401:
              errorMessage = 'API密钥无效，请联系管理员';
              break;
            case 402:
              errorMessage = '账户余额不足，请充值';
              break;
            case 429:
              errorMessage = '请求过于频繁，请稍后再试';
              break;
            case 500:
              errorMessage = '服务器错误，请稍后重试';
              break;
            default:
              errorMessage = `请求失败 (${error.response.status}): ${error.response.data?.error?.message || '未知错误'}`;
          }
        } else if (error.request) {
          if (error.code === 'ECONNABORTED') {
            errorMessage = '请求超时，请检查网络连接后重试';
          } else {
            errorMessage = '网络连接失败，请检查网络设置';
          }
        }
        
        this.$message.error(errorMessage);
      } finally {
        this.loading = false;
      }
    },
    scrollToBottom() {
      const container = this.$refs.messageContainer;
      if (container) {
        // 使用即时滚动而不是平滑滚动，提高响应速度
        container.scrollTop = container.scrollHeight;
      }
    }
  }
}
</script>

<style scoped>
.ai-assistant {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
  position: relative;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: white;
  position: relative;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  padding-bottom: 252px; /* 140px(输入框高度) + 112px(3公分间距) */
  background: #f8f9fa;
  position: relative;
  height: 100%;
  box-sizing: border-box;
}

.message {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
}

/* 移除消息淡入动画 */
@keyframes fadeIn {
  from { opacity: 1; }
  to { opacity: 1; }
}

.message-content {
  display: flex;
  align-items: flex-start;
  max-width: 85%;
  gap: 12px;
}

.message.user .message-content {
  margin-left: auto;
  flex-direction: row-reverse;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #409EFF;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.message.assistant .avatar {
  background: linear-gradient(135deg, #36D1DC 0%, #5B86E5 100%);
}

.text {
  background: white;
  padding: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  word-break: break-word;
  white-space: pre-wrap;
}

.message.user .text {
  background: #409EFF;
  color: white;
}

/* 优化消息内容渲染 */
.message-text {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-time {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
  text-align: right;
}

.message.user .message-time {
  color: rgba(255, 255, 255, 0.8);
}

.chat-input {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: white;
  border-top: 1px solid #e4e7ed;
  display: flex;
  gap: 12px;
  align-items: flex-end;
  height: 140px;
  box-sizing: border-box;
  z-index: 100;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

.chat-input .el-textarea {
  flex: 1;
}

.chat-input .el-textarea >>> .el-textarea__inner {
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  border: 1px solid #dcdfe6;
  transition: all 0.3s;
  height: 80px !important;
}

.chat-input .el-textarea >>> .el-textarea__inner:focus {
  border-color: #409EFF;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.send-button {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.3s;
  height: 80px;
  align-self: flex-end;
}

.send-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #409EFF;
  border-radius: 50%;
  animation: typing 1s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

/* 优化滚动条样式，减少视觉效果 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(193, 193, 193, 0.5);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(168, 168, 168, 0.7);
}

/* 优化滚动到底部按钮 */
.scroll-to-bottom {
  position: fixed;
  right: 20px;
  bottom: 160px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.9);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease;
  z-index: 99;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  will-change: transform;
}

.scroll-to-bottom:hover {
  transform: translateY(-2px);
}
</style> 