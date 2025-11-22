// services/vulnerabilityScannerRace/generateVulnerableHTML.ts

import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude API를 사용하여 취약한 HTML 웹 애플리케이션 생성
 */
export async function generateVulnerableHTML(scenario: any): Promise<string> {

  // API 키 확인
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️ ANTHROPIC_API_KEY not found. Returning fallback HTML.');
    return generateFallbackHTML(scenario);
  }

  console.log('✅ ANTHROPIC_API_KEY found:', process.env.ANTHROPIC_API_KEY.substring(0, 20) + '...');

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // 취약점 정보 포맷팅
    const vulnsDescription = scenario.data.vulnerabilities
      .map((v: any, index: number) => `
${index + 1}. ${v.vulnType} (${v.severity || 'MEDIUM'})
   - Endpoint: ${v.endpoint || '/'}
   - Parameter: ${v.parameter || 'N/A'}
   - Trigger: ${v.validation?.expectedPayload || 'any input'}
   - Description: ${v.description || 'No description'}
   - vulnId: ${v.vulnId}
`)
      .join('\n');

    const prompt = `
You are a cybersecurity educator. Create a single, self-contained HTML file for a vulnerable web application training scenario.

**Target Application Details:**
- Name: ${scenario.data.targetName || 'Practice Web App'}
- Description: ${scenario.data.targetDescription || 'A web application with intentional vulnerabilities'}
- Theme: ${scenario.data.htmlTemplate?.theme || 'login'} (e.g., login portal, online shop, blog, social network)
- Difficulty: ${scenario.difficulty}

**Vulnerabilities to Include:**
${vulnsDescription}

**Requirements:**

1. **Single HTML File**: All CSS and JavaScript must be inline (no external files)

2. **Realistic UI**:
   - Professional, modern design (use CSS Grid/Flexbox, gradients, shadows)
   - Don't make vulnerabilities obvious
   - Include navigation, headers, footers
   - Responsive design

3. **Functional Pages**:
   - Create multiple sections/pages within the single HTML
   - Use JavaScript to show/hide sections (SPA-like behavior)

4. **Vulnerability Implementation**:
   - Each vulnerability should be realistic and exploitable
   - When successfully exploited, send a postMessage to parent:
     \`\`\`javascript
     window.parent.postMessage({
       type: 'vulnerability_found',
       vulnId: 'vuln_xxx',
       vulnType: 'SQLi',
       endpoint: '/login'
     }, '*');
     \`\`\`
   - Include visual feedback (success messages, data displayed, etc.)

5. **Simulated Backend**:
   - Use JavaScript to simulate server responses
   - Store data in localStorage or variables
   - Fake database queries with string manipulation

6. **Security Testing Features**:
   - Include forms, inputs, search boxes, file uploads (simulated)
   - Add URL parameters handling (window.location.hash or search params)
   - DOM manipulation opportunities

**Example Vulnerabilities:**

- **SQL Injection**: Check if input contains \`' OR 1=1--\` or similar patterns
- **XSS**: Check if input contains \`<script>\`, \`<img src=x onerror=>\`, etc., then render it unsafely
- **IDOR**: Allow accessing other users' data by changing ID in URL/form
- **CSRF**: Missing token validation in state-changing operations
- **Path Traversal**: Check for \`../\` in file paths

**Important:**
- Return ONLY the HTML code
- No explanations, no markdown code blocks, just pure HTML
- Start with \`<!DOCTYPE html>\`
- Make it look professional, not like a training exercise

Begin:
`;

    console.log('🤖 Calling Claude API to generate vulnerable HTML...');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4000,
      temperature: 0.8, // 약간의 창의성
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // 응답에서 HTML 추출
    let html = '';
    if (message.content && message.content.length > 0) {
      const textContent = message.content[0];
      if (textContent.type === 'text') {
        html = textContent.text;
      }
    }

    // HTML 태그로 시작하는지 확인
    if (!html.trim().startsWith('<!DOCTYPE') && !html.trim().startsWith('<html')) {
      console.warn('⚠️ Claude response doesn\'t start with HTML. Using fallback.');
      return generateFallbackHTML(scenario);
    }

    console.log('✅ Vulnerable HTML generated successfully');
    return html;

  } catch (error: any) {
    console.error('❌ Error generating HTML with Claude:', error.message);
    return generateFallbackHTML(scenario);
  }
}

/**
 * Fallback: 간단한 하드코딩된 HTML (API 실패 시 사용)
 */
function generateFallbackHTML(scenario: any): string {
  const vulns = scenario.data.vulnerabilities || [];
  const targetName = scenario.data.targetName || 'Practice Web App';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${targetName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 400px;
      width: 100%;
      padding: 40px;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 28px;
    }
    p {
      color: #666;
      margin-bottom: 30px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #555;
      font-weight: 500;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.3s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
    }
    button:active {
      transform: translateY(0);
    }
    .result {
      margin-top: 20px;
      padding: 15px;
      border-radius: 6px;
      display: none;
    }
    .result.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
      display: block;
    }
    .result.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 ${targetName}</h1>
    <p>Welcome! Please log in to continue.</p>

    <form id="loginForm">
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" placeholder="Enter username" required>
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" placeholder="Enter password" required>
      </div>

      <button type="submit">Login</button>
    </form>

    <div id="result" class="result"></div>
  </div>

  <script>
    // Simulated vulnerable login
    document.getElementById('loginForm').addEventListener('submit', function(e) {
      e.preventDefault();

      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const resultDiv = document.getElementById('result');

      // Vulnerable SQL query simulation
      const query = "SELECT * FROM users WHERE username='" + username + "' AND password='" + password + "'";

      // Check for SQL Injection
      const sqliPayloads = ["' OR 1=1--", "' OR '1'='1", "admin'--", "' OR 'a'='a"];
      const isSQLi = sqliPayloads.some(payload => username.includes(payload) || password.includes(payload));

      if (isSQLi) {
        resultDiv.className = 'result success';
        resultDiv.innerHTML = '✅ <strong>Login Successful!</strong><br>Welcome, Administrator!<br><small>Query: ' + query + '</small>';

        // Notify parent window
        window.parent.postMessage({
          type: 'vulnerability_found',
          vulnId: '${vulns[0]?.vulnId || 'vuln_001'}',
          vulnType: 'SQLi',
          endpoint: '/login'
        }, '*');
      } else {
        resultDiv.className = 'result error';
        resultDiv.innerHTML = '❌ <strong>Login Failed!</strong><br>Invalid credentials.';
      }
    });
  </script>
</body>
</html>`;
}
