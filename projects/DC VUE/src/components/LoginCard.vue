<script setup>
import { ref } from 'vue'

const username = ref('')
const password = ref('')

const handleLogin = () => {
  console.log('Login attempt:', { username: username.value, password: password.value })
  // Add login logic here
}
</script>

<template>
  <div class="login-page">
    <!-- Logo in top left -->
    <div class="logo-container">
      <!-- Replace src with your actual logo path -->
      <img src="/kyrx-logo.png" alt="KYRX Logo" class="logo" />
    </div>

    <!-- Login Card -->
    <div class="login-card">
      <h2>Login</h2>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">USERNAME</label>
          <input 
            id="username" 
            v-model="username" 
            type="text" 
            placeholder="Type your username"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">PASSWORD</label>
          <input 
            id="password" 
            v-model="password" 
            type="password" 
            placeholder="Type your password"
            required
          />
        </div>

        <button type="submit" class="login-btn">
          Login
        </button>
      </form>

      <div class="footer-text">
        <p>dev/:- Panther, powered by KYRX</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  position: relative;
  background-color: #1e1e2e; /* Dark background since no image */
  color: #fff;
}

.logo-container {
  position: absolute;
  top: 2rem;
  left: 2rem;
}

.logo {
  height: 50px; /* Adjust based on your logo aspect ratio */
  object-fit: contain;
}

.login-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 3rem;
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  text-align: center;
}

h2 {
  margin-bottom: 2rem;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: 1px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  text-align: left;
}

label {
  font-size: 0.8rem;
  color: #a0a0a0;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

input {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 12px;
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s, background 0.3s;
}

input:focus {
  border-color: #646cff;
  background: rgba(255, 255, 255, 0.15);
}

.login-btn {
  background: #fff;
  color: #000;
  border: none;
  padding: 12px;
  border-radius: 25px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
}

.footer-text {
  margin-top: 2rem;
  font-size: 0.8rem;
  color: #666;
}
</style>
