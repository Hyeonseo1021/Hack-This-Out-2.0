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

    // 취약점 타입별 필요한 UI 요소 매핑
    const vulnTypeToUI: Record<string, string> = {
      'SQLi': 'Login form with username and password fields',
      'SQL Injection': 'Login form with username and password fields',
      'XSS': 'Search bar or input field that displays user input back on the page',
      'Cross-Site Scripting (XSS)': 'Search bar or input field that displays user input back on the page',
      'CSRF': 'Settings form or action button (transfer, change password, etc.)',
      'IDOR': 'User profile page with ID parameter in URL or hidden field',
      'Path Traversal': 'File download link or file viewer with filename parameter',
      'Command Injection': 'System utility input (ping tool, DNS lookup, etc.)',
      'Auth Bypass': 'Login form with authentication check',
      'Authentication Bypass': 'Login form with authentication check',
      'Info Disclosure': 'Page with hidden comments, debug info, or exposed config',
      'Information Disclosure': 'Page with hidden comments, debug info, or exposed config',
      'File Upload': 'File upload form with file type validation',
      'XXE': 'XML file upload or XML input textarea',
      'SSRF': 'URL input field (image fetcher, URL preview, webhook config)',
      'Deserialization': 'Cookie-based session or data import functionality',
      'Insecure Deserialization': 'Cookie-based session or data import functionality',
    };

    const vulnsDescription = scenario.data.vulnerabilities
      .map((v: any, index: number) => {
        const vulnName = typeof v.vulnName === 'object' ? v.vulnName.en : (v.vulnName || v.vulnType);
        const requiredUI = vulnTypeToUI[v.vulnType] || 'Appropriate input field';
        return `
${index + 1}. ${v.vulnType} - "${vulnName}" (${v.difficulty || 'MEDIUM'})
   - vulnId: ${v.vulnId}
   - Endpoint: ${v.endpoint || '/'}
   - Parameter: ${v.parameter || 'N/A'}
   - Trigger Payload: ${v.validation?.expectedPayload || 'any input'}
   - **REQUIRED UI ELEMENT**: ${requiredUI}
   - This vulnerability MUST have a working ${v.parameter} input field!`;
      })
      .join('\n');

    // 시나리오에서 features 가져오기
    const scenarioFeatures = scenario.data.features || [];
    const featuresDescription = scenarioFeatures.length > 0 
      ? scenarioFeatures.join(', ')
      : 'Login form, search functionality';

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

    const theme = scenario.data.htmlTemplate?.theme || scenario.data.theme || 'shopping';
    const themeInfo = themeDetails[theme] || themeDetails['shopping'];

    // targetName과 targetDescription이 객체일 수 있음 (다국어 지원)
    const targetName = typeof scenario.data.targetName === 'object' 
      ? scenario.data.targetName.en 
      : (scenario.data.targetName || 'Practice Web App');
    const targetDescription = typeof scenario.data.targetDescription === 'object'
      ? scenario.data.targetDescription.en
      : (scenario.data.targetDescription || 'A web application with intentional vulnerabilities');

    const prompt = `
You are an expert web developer creating a REALISTIC, FULLY FUNCTIONAL vulnerable web application for cybersecurity training.

**Application Info:**
- Theme: ${theme.toUpperCase()}
- Visual Style: ${themeInfo.style}
- App Name: ${targetName}
- Description: ${targetDescription}

**REQUIRED FEATURES (MUST INCLUDE ALL AND MAKE FUNCTIONAL):**
${featuresDescription}

**Vulnerabilities to Implement:**
${vulnsDescription}

=== CRITICAL REQUIREMENTS ===

**1. REALISTIC VISUAL DESIGN (NOT a simple demo!):**
- Header with logo, navigation menu, user account icon
- Proper color scheme matching ${theme} theme
- Footer with copyright, links
- Multiple sections/panels on the page
- Product cards, banners, or relevant content for ${theme}
- Hover effects, transitions, box shadows
- At least 300+ lines of HTML/CSS/JS
- Make it look like a PRODUCTION website, not a homework assignment

**2. EVERY INPUT MUST BE FUNCTIONAL:**
- Login form: Shows success/error message on submit
- Search bar: MUST have a search button or Enter key handler, displays "Search results for: [query]" 
- All buttons must have click handlers
- All forms must have submit handlers
- NO dead links - use "#" with preventDefault or show modal

**3. IMPORTANT - DO NOT VALIDATE IN HTML:**
The HTML should NOT try to validate if the payload is correct. ALL submissions should be sent to the backend for validation.

For ALL form submissions:
\`\`\`javascript
// DO NOT check if payload is correct in HTML!
// Just show "Checking..." and send to backend
resultDiv.innerHTML = '⏳ Checking...';
resultDiv.style.cssText = 'background:#e7f3ff;color:#0066cc;padding:15px;border-radius:6px;';

// ALWAYS send as vulnerability_attempt - backend will validate
window.parent.postMessage({
  type: 'vulnerability_attempt',
  vulnType: 'SQLi',  // or 'XSS', etc.
  vulnId: 'EXACT_VULN_ID_FROM_ABOVE',
  endpoint: '/login',
  parameter: 'username',
  payload: inputValue
}, '*');
\`\`\`

**4. DO NOT INCLUDE showHackEffect function:**
Do NOT show any "SYSTEM COMPROMISED" or hacking animations. The parent page will handle success/failure feedback.

**5. postMessage FORMAT:**
ALWAYS use type: 'vulnerability_attempt' - the backend will determine if it's correct
{ type: 'vulnerability_attempt', vulnId: '[EXACT_VULN_ID]', vulnType: '...', endpoint: '...', parameter: '...', payload: '...' }

**7. PREVENT NAVIGATION:**
\`\`\`javascript
document.querySelectorAll('a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); }));
\`\`\`

=== OUTPUT FORMAT ===
- Output ONLY valid HTML starting with <!DOCTYPE html>
- Single file with inline CSS and JavaScript
- NO markdown, NO explanations, NO comments outside the HTML
- Minimum 300 lines of code

Generate the complete HTML now:
`;

    console.log('🤖 Calling Claude API to generate vulnerable HTML...');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 8000, 
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: prompt
        },
        {
          role: 'assistant',
          content: '<!DOCTYPE html>'
        }
      ]
    });

    // Prefill로 '<!DOCTYPE html>'을 이미 시작했으므로 앞에 붙여줌
    let html = '<!DOCTYPE html>';
    if (message.content && message.content.length > 0) {
      const textContent = message.content[0];
      if (textContent.type === 'text') {
        html += textContent.text;
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

      // ✅ HTML에서는 검증하지 않고 항상 백엔드에 전송
      // 백엔드에서 expectedPayload와 비교하여 정확히 검증
      resultDiv.className = 'result';
      resultDiv.innerHTML = '⏳ <strong>Checking...</strong>';
      resultDiv.style.display = 'block';
      resultDiv.style.background = '#e7f3ff';
      resultDiv.style.color = '#0066cc';
      resultDiv.style.border = '1px solid #b3d9ff';

      console.log('[HTML] 📤 Sending submission to backend for validation:', { parameter: usedParameter, payload: usedPayload });

      // 항상 vulnerability_attempt로 전송 - 백엔드가 판단
      window.parent.postMessage({
        type: 'vulnerability_attempt',
        vulnType: sqliVuln.vulnType,
        endpoint: sqliVuln.endpoint || '/login',
        parameter: usedParameter,
        payload: usedPayload
      }, '*');

      // 2초 후 메시지 숨김 (결과는 상위 페이지 toast에서 표시)
      setTimeout(function() {
        resultDiv.style.display = 'none';
      }, 2000);
    });

    // 상위 페이지에서 결과 메시지 받기
    window.addEventListener('message', function(event) {
      const resultDiv = document.getElementById('result');
      if (!resultDiv) return;

      if (event.data.type === 'submission_result') {
        if (event.data.success) {
          resultDiv.className = 'result success';
          resultDiv.innerHTML = '✅ <strong>Correct!</strong> ' + (event.data.message || '');
          resultDiv.style.display = 'block';
          resultDiv.style.background = '#d4edda';
          resultDiv.style.color = '#155724';
          resultDiv.style.border = '1px solid #c3e6cb';
        } else {
          resultDiv.className = 'result error';
          resultDiv.innerHTML = '❌ <strong>Incorrect</strong> ' + (event.data.message || '');
          resultDiv.style.display = 'block';
          resultDiv.style.background = '#f8d7da';
          resultDiv.style.color = '#721c24';
          resultDiv.style.border = '1px solid #f5c6cb';
        }

        // 3초 후 메시지 숨김
        setTimeout(function() {
          resultDiv.style.display = 'none';
        }, 3000);
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