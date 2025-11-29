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

    // 테마 목록
    const themeDetails: Record<string, { style: string; features: string }> = {
      'bank': {
        style: 'Corporate blue theme, serious financial look, security badges',
        features: 'Account balance display, transfer forms, transaction history'
      },
      'shopping': {
        style: 'Modern e-commerce, product cards, shopping cart icon',
        features: 'Product search, cart, checkout form, user reviews'
      },
      'social': {
        style: 'Social media vibes, user avatars, feed layout',
        features: 'Posts, comments, friend search, profile settings'
      },
      'gaming': {
        style: 'Dark theme with neon accents, gamer aesthetic',
        features: 'Leaderboards, player profiles, in-game currency'
      },
      'healthcare': {
        style: 'Clean medical theme, trust-inspiring design',
        features: 'Patient records, appointment booking, prescription history'
      },
      'corporate': {
        style: 'Professional business portal, minimalist design',
        features: 'Employee directory, document upload, internal messaging'
      },
      'cafe': {
        style: 'Warm colors, cozy aesthetic, menu display',
        features: 'Online ordering, loyalty points, reservation form'
      },
      'streaming': {
        style: 'Dark theme, video thumbnails, playlist layout',
        features: 'Video search, user playlists, subscription management'
      },
      'login': {
        style: 'Simple centered login form, gradient background',
        features: 'Login form, forgot password, remember me'
      }
    };

    const theme = scenario.data.htmlTemplate?.theme || 'login';
    const themeInfo = themeDetails[theme] || themeDetails['login'];

    const prompt = `
You are creating a REALISTIC vulnerable web application for cybersecurity training.

**Application Theme: ${theme.toUpperCase()}**
- Visual Style: ${themeInfo.style}
- Key Features: ${themeInfo.features}
- App Name: ${scenario.data.targetName || 'Practice Web App'}
- Description: ${scenario.data.targetDescription || 'A web application with intentional vulnerabilities'}

**Vulnerabilities to Include:**
${vulnsDescription}

**REQUIREMENTS:**

1. **Realistic Design**:
   - Make it look like a REAL ${theme} website (not a training demo)
   - Use modern CSS (gradients, shadows, animations)
   - Include proper branding, logo placeholder, navigation
   - Add realistic placeholder content and data

2. **Hacking Success Feedback** (VERY IMPORTANT):
   When a vulnerability is successfully exploited, show a DRAMATIC "hacked" effect:
   - Screen glitch/flicker animation
   - Show leaked data dramatically (e.g., database dump, admin access)
   - Display success message like "ACCESS GRANTED" or "DATABASE EXPOSED"
   - Make the user FEEL like a real hacker
   - Example effects: matrix rain, terminal-style output, data scrolling

   For wrong attempts, just show normal error (e.g., "Invalid credentials")

3. **Single HTML File**: All CSS and JavaScript inline

4. **Vulnerability Detection**:
   - ON EVERY FORM SUBMISSION, send postMessage:

   If SUCCESSFUL exploit:
   \`\`\`javascript
   // Show dramatic hacking effect first, then:
   window.parent.postMessage({
     type: 'vulnerability_found',
     vulnId: 'vuln_xxx',
     vulnType: 'SQLi',
     endpoint: '/login',
     parameter: 'username',
     payload: inputValue
   }, '*');
   \`\`\`

   If WRONG attempt:
   \`\`\`javascript
   window.parent.postMessage({
     type: 'vulnerability_attempt',
     vulnType: 'SQLi',
     endpoint: '/login',
     parameter: 'username',
     payload: inputValue
   }, '*');
   \`\`\`

5. **NO AUTO-TRIGGER**:
   - NEVER trigger on page load
   - ONLY trigger on user actions (form submit, button click)

6. **Payload Detection Examples**:
   - SQLi: \`' OR 1=1--\`, \`' OR '1'='1\`, \`admin'--\`
   - XSS: \`<script>\`, \`<img onerror=\`, \`javascript:\`
   - IDOR: accessing different user IDs
   - Path Traversal: "../", "..\\\\"

**HACKING SUCCESS EFFECT EXAMPLE:**
Create a showHackEffect() function that:
- Creates a full-screen overlay (position:fixed, z-index:9999)
- Black background (rgba(0,0,0,0.95)) with green text (#0f0)
- Monospace font, terminal-style appearance
- Shows animated text like:
  "[*] Exploiting vulnerability..."
  "[*] Bypassing authentication..."
  "[+] ACCESS GRANTED"
  "[+] Dumping database..."
  Then display a fake database table with usernames and password hashes
  "[!] System compromised successfully"
- Add glitch/flicker CSS animation
- Auto-remove after 3-4 seconds

**OUTPUT RULES:**
- Start with \`<!DOCTYPE html>\` immediately
- NO markdown, NO explanations
- Self-contained HTML only
- Prevent link navigation with JavaScript

OUTPUT THE HTML NOW:
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

      // Determine which field was used and what value
      let usedPayload = username || password;
      let usedParameter = 'username';

      if (username.length > 0) {
        usedPayload = username;
        usedParameter = 'username';
      } else if (password.length > 0) {
        usedPayload = password;
        usedParameter = 'password';
      }

      if (isSQLi) {
        resultDiv.className = 'result success';
        resultDiv.innerHTML = '✅ <strong>Login Successful!</strong><br>Welcome, Administrator!<br><small>Query: ' + query + '</small>';

        // Check which field had the SQLi payload
        const foundInUsername = sqliPayloads.find(p => username.includes(p));
        if (foundInUsername) {
          usedPayload = username;
          usedParameter = 'username';
        } else {
          const foundInPassword = sqliPayloads.find(p => password.includes(p));
          if (foundInPassword) {
            usedPayload = password;
            usedParameter = 'password';
          }
        }

        console.log('[HTML] ✅ Vulnerability found! Sending postMessage:', { vulnId: sqliVuln.vulnId, parameter: usedParameter, payload: usedPayload });

        // Notify parent window - CORRECT submission
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

        console.log('[HTML] ❌ Wrong submission. Sending postMessage:', { parameter: usedParameter, payload: usedPayload });

        // Notify parent window - WRONG submission (let backend decide)
        window.parent.postMessage({
          type: 'vulnerability_attempt',
          vulnType: 'SQLi',
          endpoint: sqliVuln.endpoint || '/login',
          parameter: usedParameter,
          payload: usedPayload
        }, '*');
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