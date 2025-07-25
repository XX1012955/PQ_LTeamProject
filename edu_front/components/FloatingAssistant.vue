<template>
  <div class="floating-assistant" :class="{ 'is-active': isActive }">
    <div class="floating-ball" 
         @click="toggleChat"
         @mousedown="startDrag"
         :style="{ left: position.x + 'px', top: position.y + 'px' }"
    >
      <i class="el-icon-service"></i>
    </div>
    <div class="chat-window" v-show="isActive">
      <div class="chat-header">
        <h2><i class="el-icon-service"></i> 智能助手</h2>
        <div class="header-subtitle">基于 DeepSeek 大模型</div>
        <el-button 
          class="exit-button" 
          type="text" 
          @click="closeChat"
        >
          <i class="el-icon-close"></i>
        </el-button>
      </div>
      <AIAssistant />
    </div>
  </div>
</template>

<script>
import AIAssistant from './AIAssistant.vue'

export default {
  name: 'FloatingAssistant',
  components: {
    AIAssistant
  },
  data() {
    return {
      isActive: false,
      position: {
        x: window.innerWidth - 100, // 初始位置在右下角
        y: window.innerHeight - 100
      },
      isDragging: false,
      dragOffset: {
        x: 0,
        y: 0
      }
    }
  },
  mounted() {
    // 添加全局鼠标事件监听
    document.addEventListener('mousemove', this.onDrag)
    document.addEventListener('mouseup', this.stopDrag)
    // 监听窗口大小变化
    window.addEventListener('resize', this.handleResize)
  },
  beforeDestroy() {
    // 移除事件监听
    document.removeEventListener('mousemove', this.onDrag)
    document.removeEventListener('mouseup', this.stopDrag)
    window.removeEventListener('resize', this.handleResize)
  },
  methods: {
    toggleChat() {
      if (!this.isDragging) {
        this.isActive = !this.isActive
      }
    },
    closeChat() {
      this.isActive = false
    },
    startDrag(event) {
      this.isDragging = true
      // 计算鼠标点击位置与悬浮球左上角的偏移
      const rect = event.target.getBoundingClientRect()
      this.dragOffset = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      }
    },
    onDrag(event) {
      if (this.isDragging) {
        // 计算新位置
        let newX = event.clientX - this.dragOffset.x
        let newY = event.clientY - this.dragOffset.y

        // 限制不超出屏幕边界
        const maxX = window.innerWidth - 60 // 悬浮球宽度
        const maxY = window.innerHeight - 60 // 悬浮球高度

        newX = Math.max(0, Math.min(newX, maxX))
        newY = Math.max(0, Math.min(newY, maxY))

        this.position = {
          x: newX,
          y: newY
        }
      }
    },
    stopDrag() {
      this.isDragging = false
    },
    handleResize() {
      // 窗口大小改变时，确保悬浮球在可视区域内
      const maxX = window.innerWidth - 60
      const maxY = window.innerHeight - 60

      this.position = {
        x: Math.min(this.position.x, maxX),
        y: Math.min(this.position.y, maxY)
      }
    }
  }
}
</script>

<style scoped>
.floating-assistant {
  position: fixed;
  z-index: 9999;
}

.floating-ball {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #409EFF 0%, #36D1DC 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  position: fixed;
  user-select: none;
}

.floating-ball i {
  font-size: 28px;
  color: white;
}

.floating-ball:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.chat-window {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 60vw;
  height: 80vh;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, -48%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}

.chat-header {
  padding: 16px 20px;
  background: linear-gradient(135deg, #409EFF 0%, #36D1DC 100%);
  color: white;
  text-align: center;
  position: relative;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chat-header h2 {
  margin: 0;
  font-size: 1.5em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.header-subtitle {
  font-size: 0.9em;
  opacity: 0.8;
  margin-top: 5px;
}

.exit-button {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  color: white;
  font-size: 20px;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.exit-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-50%) scale(1.1);
}

.exit-button i {
  font-size: 24px;
}

.is-active .floating-ball {
  transform: scale(0.8);
  opacity: 0.8;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(64, 158, 255, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(64, 158, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(64, 158, 255, 0);
  }
}

.floating-ball {
  animation: pulse 2s infinite;
}
</style> 