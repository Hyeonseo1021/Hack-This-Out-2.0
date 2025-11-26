// services/vulnerabilityScannerRace/generateVulnerableHTML.ts

import Anthropic from '@anthropic-ai/sdk';

export async function generateVulnerableHTML(scenario: any): Promise<string> {

  const useFallback = process.env.USE_FALLBACK_HTML === 'true';
  if (useFallback) {
    console.log('⚙️ USE_FALLBACK_HTML=true, using fallback HTML to save costs');
    return generateFallbackHTML(scenario);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️ ANTHROPIC_API_KEY not found. Returning fallback HTML.');
    return generateFallbackHTML(scenario);
  }

  console.log('✅ ANTHROPIC_API_KEY found:', process.env.ANTHROPIC_API_KEY.substring(0, 20) + '...');

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

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
   - **CRITICAL - NO AUTO-TRIGGER**: Vulnerabilities should ONLY be triggered when the user actively submits a form or performs an action (button click, form submit, link click with malicious parameter, etc.)
   - **DO NOT** trigger vulnerabilities on page load, on DOMContentLoaded, or automatically
   - **DO NOT** send postMessage on page initialization
   - **DO NOT** automatically trigger IDOR vulnerabilities when the page loads - user must click a button, submit a form, or change a URL parameter
   - When successfully exploited BY USER ACTION, send a postMessage to parent with ALL required fields:
     \`\`\`javascript
     window.parent.postMessage({
       type: 'vulnerability_found',
       vulnId: 'vuln_xxx',        // The vulnerability ID from the scenario
       vulnType: 'SQLi',           // Type: SQLi, XSS, IDOR, etc.
       endpoint: '/login',         // The endpoint that was exploited
       parameter: 'username',      // The actual parameter name that contained the payload
       payload: usernameValue      // The FULL INPUT VALUE that triggered the vulnerability
     }, '*');
     \`\`\`
   - CRITICAL: You must detect which form field (username/password/query/etc.) contained the exploit
   - CRITICAL: Send the ENTIRE value of that field as 'payload', not just a pattern
   - CRITICAL: Send the field name as 'parameter' (e.g., 'username', 'password', 'query')
   - CRITICAL: Only send postMessage when user ACTIVELY triggers the vulnerability (form submission, button click, changing URL hash, etc.)
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

**CRITICAL INSTRUCTIONS:**
- Your response MUST start with \`<!DOCTYPE html>\` immediately
- Do NOT include ANY explanations, comments, or text before or after the HTML
- Do NOT wrap the HTML in markdown code blocks (\`\`\`html)
- Return ONLY the complete, valid HTML document
- The HTML must be self-contained (all CSS and JS inline)
- Make it look professional and realistic

**IMPORTANT - Navigation Prevention:**
- Add this script at the end of the <body> to prevent all link navigation:
  \`\`\`javascript
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      document.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
        });
      });
    });
  </script>
  \`\`\`
- All navigation must be handled via JavaScript (showing/hiding sections)
- NO actual page navigation should occur

OUTPUT THE HTML NOW (start with <!DOCTYPE html>):
`;

    console.log('🤖 Calling Claude API to generate vulnerable HTML...');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 5000, 
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    let html = '';
    if (message.content && message.content.length > 0) {
      const textContent = message.content[0];
      if (textContent.type === 'text') {
        html = textContent.text;
      }
    }

    const codeBlockMatch = html.match(/```(?:html)?\s*(<!DOCTYPE[\s\S]*?<\/html>)\s*```/i);
    if (codeBlockMatch) {
      html = codeBlockMatch[1];
      console.log('✅ Extracted HTML from markdown code block');
    }

    const trimmedHtml = html.trim();
    if (!trimmedHtml.startsWith('<!DOCTYPE') && !trimmedHtml.startsWith('<html')) {
      console.warn('⚠️ Claude response doesn\'t start with HTML. First 200 chars:', trimmedHtml.substring(0, 200));
      console.warn('⚠️ Using fallback HTML instead.');
      return generateFallbackHTML(scenario);
    }

    if (trimmedHtml.length < 500) {
      console.warn('⚠️ Generated HTML too short:', trimmedHtml.length, 'chars. Using fallback.');
      return generateFallbackHTML(scenario);
    }

    console.log('✅ Vulnerable HTML generated successfully (', trimmedHtml.length, 'chars)');
    return trimmedHtml;

  } catch (error: any) {
    console.error('❌ Error generating HTML with Claude:', error.message);
    return generateFallbackHTML(scenario);
  }
}

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
    // Load vulnerability data from server
    const vulns = ${JSON.stringify(vulns, null, 2)};
    const sqliVuln = vulns.find(v => v.vulnType === 'SQLi') || vulns[0];

    // Simulated vulnerable login
    document.getElementById('loginForm').addEventListener('submit', function(e) {
      e.preventDefault();

      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const resultDiv = document.getElementById('result');

      // Vulnerable SQL query simulation
      const query = "SELECT * FROM users WHERE username='" + username + "' AND password='" + password + "'";

      // Check for SQL Injection - use scenario's expected payload
      const expectedPayload = sqliVuln.validation?.expectedPayload || "' OR 1=1--";
      const sqliPayloads = [expectedPayload, "' OR 1=1--", "' OR '1'='1", "admin'--", "' OR 'a'='a"];
      const isSQLi = sqliPayloads.some(payload => username.includes(payload) || password.includes(payload));

      if (isSQLi) {
        resultDiv.className = 'result success';
        resultDiv.innerHTML = '✅ <strong>Login Successful!</strong><br>Welcome, Administrator!<br><small>Query: ' + query + '</small>';

        // Determine which field had the SQLi payload and what it was
        let usedPayload = '';
        let usedParameter = sqliVuln.parameter || 'username';

        // Check username field first
        const foundInUsername = sqliPayloads.find(p => username.includes(p));
        if (foundInUsername) {
          usedPayload = username;
          usedParameter = 'username';
        } else {
          // Check password field
          const foundInPassword = sqliPayloads.find(p => password.includes(p));
          if (foundInPassword) {
            usedPayload = password;
            usedParameter = 'password';
          }
        }

        console.log('[HTML] Sending postMessage:', { vulnId: sqliVuln.vulnId, parameter: usedParameter, payload: usedPayload });

        // Notify parent window with correct vulnerability info
        window.parent.postMessage({
          type: 'vulnerability_found',
          vulnId: sqliVuln.vulnId,
          vulnType: sqliVuln.vulnType,
          endpoint: sqliVuln.endpoint,
          parameter: usedParameter,
          payload: usedPayload
        }, '*');
      } else {
        resultDiv.className = 'result error';
        resultDiv.innerHTML = '❌ <strong>Login Failed!</strong><br>Invalid credentials.';
      }
    });

    // Prevent all link navigation
    document.addEventListener('DOMContentLoaded', function() {
      document.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
        });
      });
    });
  </script>
</body>
</html>`;
}