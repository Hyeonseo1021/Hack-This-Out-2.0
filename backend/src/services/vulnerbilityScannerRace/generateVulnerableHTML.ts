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

    // 취약점별 상세 정보 생성 (AI가 정확히 사용해야 함)
    const vulnsDescription = scenario.data.vulnerabilities
      .map((v: any, index: number) => {
        const vulnName = typeof v.vulnName === 'object' ? v.vulnName.en : (v.vulnName || v.vulnType);
        const requiredUI = vulnTypeToUI[v.vulnType] || 'Appropriate input field';
        const endpoint = v.endpoint || '/';
        const parameter = v.parameter || 'input';
        const expectedPayload = v.validation?.expectedPayload || '';

        return `
=== VULNERABILITY #${index + 1}: ${v.vulnType} ===
vulnId: "${v.vulnId}"
vulnName: "${vulnName}"
difficulty: ${v.difficulty || 'MEDIUM'}

>>> EXACT VALUES YOU MUST USE (COPY-PASTE THESE): <<<
endpoint: "${endpoint}"
parameter: "${parameter}"
expectedPayload: "${expectedPayload}"

REQUIRED UI: ${requiredUI}
INPUT NAME: The input field MUST have name="${parameter}" and id="${parameter}"

>>> MANDATORY postMessage CODE FOR THIS VULNERABILITY: <<<
\`\`\`javascript
// When user submits form for ${v.vulnType}:
window.parent.postMessage({
  type: 'vulnerability_attempt',
  vulnType: '${v.vulnType}',
  endpoint: '${endpoint}',
  parameter: '${parameter}',
  payload: document.getElementById('${parameter}').value
}, '*');
\`\`\``;
      })
      .join('\n\n');

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

    // features를 탭으로 변환
    const featuresList = scenarioFeatures.length > 0 ? scenarioFeatures : ['Login', 'Search'];
    const tabsDescription = featuresList.map((f: string, i: number) => `Tab ${i + 1}: ${f}`).join('\n');

    const prompt = `
You are a senior full-stack developer at a Fortune 500 company creating a PRODUCTION-QUALITY web application for cybersecurity training.

##############################################
#  CRITICAL: READ EVERY WORD CAREFULLY       #
#  YOUR OUTPUT WILL BE VALIDATED STRICTLY    #
##############################################

**Application Info:**
- Theme: ${theme.toUpperCase()}
- Visual Style: ${themeInfo.style}
- App Name: ${targetName}
- Description: ${targetDescription}

##############################################
#  VULNERABILITIES - USE EXACT VALUES BELOW  #
##############################################

${vulnsDescription}

##############################################
#  ABSOLUTE REQUIREMENTS (FAILURE = REJECTED) #
##############################################

**RULE 1: EXACT ENDPOINT, PARAMETER, AND PAYLOAD**
You MUST use the EXACT endpoint and parameter values shown above.
DO NOT invent your own values. DO NOT change them.
The backend validates these EXACT strings. Different values = FAILURE.

**RULE 2: INPUT FIELD IDs MUST MATCH PARAMETERS**
For each vulnerability, the input field id/name MUST be the EXACT parameter name.
Example: If parameter is "keyword", use: <input id="keyword" name="keyword">
NOT "query", NOT "search", NOT "q" - use "keyword" EXACTLY.

**RULE 3: postMessage MUST USE EXACT VALUES**
Every postMessage call MUST use the EXACT endpoint and parameter from the vulnerability definition above.
Copy-paste the postMessage code blocks provided above - do not modify them.

##############################################
#  MULTI-PAGE TAB-BASED SPA STRUCTURE        #
##############################################

Create a Single Page Application with navigation tabs:

Required tabs: ${tabsDescription}

HTML Structure:
\`\`\`html
<nav class="main-nav">
  <a href="#" class="nav-tab active" data-tab="home">Home</a>
  <a href="#" class="nav-tab" data-tab="search">Search</a>
  <!-- more tabs -->
</nav>

<section id="home-section" class="tab-content active">...</section>
<section id="search-section" class="tab-content">...</section>
\`\`\`

Tab switching JS:
\`\`\`javascript
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    const targetTab = tab.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(targetTab + '-section').classList.add('active');
    tab.classList.add('active');
  });
});
\`\`\`

##############################################
#  DESIGN - MAKE IT LOOK LIKE A REAL WEBSITE #
##############################################

**Visual Requirements:**
1. Professional gradient header with logo, nav tabs, user dropdown
2. Sidebar navigation (optional) with icons
3. Card-based layouts with shadows and rounded corners
4. Proper typography hierarchy (h1, h2, h3, p with different sizes)
5. Loading states and smooth transitions (0.3s ease)
6. Hover effects on all interactive elements
7. Color scheme consistent with ${theme} theme
8. Footer with links and copyright

**CSS Requirements:**
- Use CSS custom properties (--primary-color, --secondary-color, etc.)
- Box shadows: box-shadow: 0 4px 20px rgba(0,0,0,0.1);
- Border radius: 8px-12px for cards
- Transitions: transition: all 0.3s ease;
- Responsive padding and margins

**Content Requirements:**
- Each section should have realistic placeholder content
- Use realistic usernames, product names, file names
- Include breadcrumbs, pagination where appropriate
- Add realistic data tables, lists, cards

**Minimum Code Length:** 500+ lines

##############################################
#  FORM SUBMISSION BEHAVIOR                  #
##############################################

ALL form submissions must:
1. Prevent default form behavior (e.preventDefault())
2. Show loading state: "Checking..."
3. Send postMessage with EXACT values from vulnerability definition
4. Do NOT validate input - backend handles validation

Example submission handler:
\`\`\`javascript
form.addEventListener('submit', function(e) {
  e.preventDefault();
  resultDiv.innerHTML = 'Checking...';
  resultDiv.style.display = 'block';

  // USE EXACT VALUES FROM VULNERABILITY DEFINITION
  window.parent.postMessage({
    type: 'vulnerability_attempt',
    vulnType: 'SQLi',        // Exact vulnType
    endpoint: '/api/login',   // Exact endpoint from definition
    parameter: 'username',    // Exact parameter from definition
    payload: document.getElementById('username').value
  }, '*');
});
\`\`\`

##############################################
#  FORBIDDEN                                  #
##############################################

- DO NOT show "SYSTEM COMPROMISED" or hack animations
- DO NOT validate payloads in JavaScript
- DO NOT invent your own endpoint/parameter values
- DO NOT use different parameter names than specified

##############################################
#  OUTPUT FORMAT                              #
##############################################

- Output ONLY raw HTML starting with <!DOCTYPE html>
- Single file with inline <style> and <script>
- NO markdown code blocks
- NO explanations before or after
- NO comments like "Here is the HTML..."

Generate the complete HTML now:
`;

    console.log('🤖 Calling Claude API to generate vulnerable HTML...');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 8192,  // Haiku's maximum output tokens
      temperature: 0.3,  // Lower temperature for more consistent output
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
  const targetNameRaw = scenario.data.targetName || 'Practice Web App';
  const targetName = typeof targetNameRaw === 'object' ? targetNameRaw.en : targetNameRaw;
  const features = scenario.data.features || ['Login', 'Search', 'Profile', 'Downloads'];

  // 취약점 타입별 매핑
  const sqliVuln = vulns.find((v: any) => v.vulnType === 'SQLi') || vulns[0];
  const xssVuln = vulns.find((v: any) => v.vulnType === 'XSS');
  const csrfVuln = vulns.find((v: any) => v.vulnType === 'CSRF');
  const pathVuln = vulns.find((v: any) => v.vulnType === 'PATH_TRAVERSAL' || v.vulnType === 'Path Traversal');
  const idorVuln = vulns.find((v: any) => v.vulnType === 'IDOR');

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
      background: #f0f2f5;
      min-height: 100vh;
    }
    /* Header */
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 60px;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    .logo {
      font-size: 20px;
      font-weight: bold;
    }
    .main-nav {
      display: flex;
      gap: 5px;
    }
    .nav-tab {
      color: rgba(255,255,255,0.8);
      text-decoration: none;
      padding: 18px 16px;
      border-bottom: 3px solid transparent;
      transition: all 0.3s;
      font-size: 14px;
    }
    .nav-tab:hover {
      color: white;
      background: rgba(255,255,255,0.1);
    }
    .nav-tab.active {
      color: white;
      border-bottom-color: white;
      font-weight: 600;
    }
    .user-icon {
      width: 36px;
      height: 36px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Main content */
    .main-content {
      max-width: 900px;
      margin: 30px auto;
      padding: 0 20px;
    }
    .tab-content {
      display: none;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      padding: 30px;
    }
    .tab-content.active {
      display: block;
    }
    h2 {
      color: #333;
      margin-bottom: 20px;
      font-size: 24px;
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
    input, select, textarea {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.3s;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: #667eea;
    }
    button, .btn {
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover, .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .result {
      margin-top: 20px;
      padding: 15px;
      border-radius: 6px;
      display: none;
    }
    /* Search */
    .search-box {
      display: flex;
      gap: 10px;
    }
    .search-box input {
      flex: 1;
    }
    .search-results {
      margin-top: 20px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      display: none;
    }
    /* File list */
    .file-list {
      list-style: none;
    }
    .file-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px;
      border-bottom: 1px solid #eee;
    }
    .file-item:last-child {
      border-bottom: none;
    }
    .download-link {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }
    .download-link:hover {
      text-decoration: underline;
    }
    /* Profile */
    .profile-card {
      display: flex;
      gap: 30px;
      margin-bottom: 30px;
    }
    .profile-avatar {
      width: 100px;
      height: 100px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 36px;
    }
    .profile-info h3 {
      margin-bottom: 10px;
    }
    /* Footer */
    .footer {
      text-align: center;
      padding: 20px;
      color: #888;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <!-- Header with tabs -->
  <header class="header">
    <div class="logo">${targetName}</div>
    <nav class="main-nav">
      <a href="#" class="nav-tab active" data-tab="login">Login</a>
      <a href="#" class="nav-tab" data-tab="search">Search</a>
      <a href="#" class="nav-tab" data-tab="profile">Profile</a>
      <a href="#" class="nav-tab" data-tab="downloads">Downloads</a>
    </nav>
    <div class="user-icon">👤</div>
  </header>

  <main class="main-content">
    <!-- Login Section -->
    <section id="login-section" class="tab-content active">
      <h2>Login</h2>
      <form id="loginForm">
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" placeholder="Enter username">
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" placeholder="Enter password">
        </div>
        <button type="submit">Login</button>
      </form>
      <div id="login-result" class="result"></div>
    </section>

    <!-- Search Section -->
    <section id="search-section" class="tab-content">
      <h2>Search</h2>
      <div class="search-box">
        <input type="text" id="searchQuery" placeholder="Search products, users, or content...">
        <button id="searchBtn">Search</button>
      </div>
      <div id="searchResults" class="search-results">
        <h4>Search Results:</h4>
        <div id="searchResultsContent"></div>
      </div>
      <div id="search-result" class="result"></div>
    </section>

    <!-- Profile Section -->
    <section id="profile-section" class="tab-content">
      <h2>My Profile</h2>
      <div class="profile-card">
        <div class="profile-avatar">👤</div>
        <div class="profile-info">
          <h3>John Doe</h3>
          <p>User ID: <input type="text" id="userId" value="1001" style="width:80px;display:inline;"></p>
          <button id="loadProfileBtn" style="margin-top:10px;">Load Profile</button>
        </div>
      </div>
      <form id="profileForm">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" value="john@example.com">
        </div>
        <div class="form-group">
          <label for="phone">Phone</label>
          <input type="text" id="phone" value="+1 234 567 8900">
        </div>
        <button type="submit">Update Profile</button>
      </form>
      <div id="profile-result" class="result"></div>
    </section>

    <!-- Downloads Section -->
    <section id="downloads-section" class="tab-content">
      <h2>File Downloads</h2>
      <p style="margin-bottom:20px;color:#666;">Download your documents and reports.</p>
      <ul class="file-list">
        <li class="file-item">
          <span>📄 report_2024.pdf</span>
          <a href="#" class="download-link" data-file="report_2024.pdf">Download</a>
        </li>
        <li class="file-item">
          <span>📊 analytics.xlsx</span>
          <a href="#" class="download-link" data-file="analytics.xlsx">Download</a>
        </li>
        <li class="file-item">
          <span>📝 notes.txt</span>
          <a href="#" class="download-link" data-file="notes.txt">Download</a>
        </li>
      </ul>
      <div class="form-group" style="margin-top:20px;">
        <label for="customFile">Or enter filename:</label>
        <div class="search-box">
          <input type="text" id="customFile" placeholder="Enter filename...">
          <button id="downloadCustomBtn">Download</button>
        </div>
      </div>
      <div id="download-result" class="result"></div>
    </section>
  </main>

  <footer class="footer">
    &copy; 2024 ${targetName}. All rights reserved.
  </footer>

  <script>
    // Vulnerability data
    const vulns = ${JSON.stringify(vulns, null, 2)};

    // Tab switching
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = tab.dataset.tab;

        document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

        document.getElementById(targetTab + '-section').classList.add('active');
        tab.classList.add('active');
      });
    });

    // Helper: Show result
    function showResult(elementId, message, isChecking) {
      const el = document.getElementById(elementId);
      if (isChecking) {
        el.innerHTML = '⏳ <strong>Checking...</strong>';
        el.style.cssText = 'display:block;background:#e7f3ff;color:#0066cc;padding:15px;border-radius:6px;';
      }
      setTimeout(() => { el.style.display = 'none'; }, 2000);
    }

    // Helper: Send to backend
    function sendAttempt(vulnType, endpoint, parameter, payload) {
      window.parent.postMessage({
        type: 'vulnerability_attempt',
        vulnType: vulnType,
        endpoint: endpoint,
        parameter: parameter,
        payload: payload
      }, '*');
    }

    // Login form (SQLi)
    document.getElementById('loginForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      showResult('login-result', '', true);
      const vuln = vulns.find(v => v.vulnType === 'SQLi') || vulns[0];
      sendAttempt(vuln?.vulnType || 'SQLi', vuln?.endpoint || '/login', 'username', username || password);
    });

    // Search (XSS)
    function doSearch() {
      const query = document.getElementById('searchQuery').value;
      showResult('search-result', '', true);

      // Display results (vulnerable - reflects input)
      const resultsDiv = document.getElementById('searchResults');
      const contentDiv = document.getElementById('searchResultsContent');
      contentDiv.innerHTML = 'Results for: <strong>' + query + '</strong>';
      resultsDiv.style.display = 'block';

      const vuln = vulns.find(v => v.vulnType === 'XSS');
      if (vuln) {
        sendAttempt('XSS', vuln.endpoint || '/search', vuln.parameter || 'query', query);
      }
    }
    document.getElementById('searchBtn').addEventListener('click', doSearch);
    document.getElementById('searchQuery').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
    });

    // Profile (CSRF / IDOR)
    document.getElementById('loadProfileBtn').addEventListener('click', function() {
      const userId = document.getElementById('userId').value;
      showResult('profile-result', '', true);
      const vuln = vulns.find(v => v.vulnType === 'IDOR');
      if (vuln) {
        sendAttempt('IDOR', vuln.endpoint || '/api/users', vuln.parameter || 'id', userId);
      }
    });

    document.getElementById('profileForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const email = document.getElementById('email').value;
      showResult('profile-result', '', true);
      const vuln = vulns.find(v => v.vulnType === 'CSRF');
      if (vuln) {
        sendAttempt('CSRF', vuln.endpoint || '/profile', vuln.parameter || 'email', email);
      }
    });

    // Downloads (Path Traversal)
    document.querySelectorAll('.download-link').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const filename = this.dataset.file;
        showResult('download-result', '', true);
        const vuln = vulns.find(v => v.vulnType === 'PATH_TRAVERSAL' || v.vulnType === 'Path Traversal');
        if (vuln) {
          sendAttempt(vuln.vulnType, vuln.endpoint || '/download', vuln.parameter || 'file', filename);
        }
      });
    });

    document.getElementById('downloadCustomBtn').addEventListener('click', function() {
      const filename = document.getElementById('customFile').value;
      showResult('download-result', '', true);
      const vuln = vulns.find(v => v.vulnType === 'PATH_TRAVERSAL' || v.vulnType === 'Path Traversal');
      if (vuln) {
        sendAttempt(vuln.vulnType, vuln.endpoint || '/download', vuln.parameter || 'file', filename);
      }
    });

    // Handle results from parent
    window.addEventListener('message', function(event) {
      if (event.data.type === 'submission_result') {
        const resultDivs = document.querySelectorAll('.result');
        resultDivs.forEach(div => {
          if (event.data.success) {
            div.innerHTML = '✅ <strong>Correct!</strong> ' + (event.data.message || '');
            div.style.cssText = 'display:block;background:#d4edda;color:#155724;padding:15px;border-radius:6px;';
          } else {
            div.innerHTML = '❌ <strong>Incorrect</strong> ' + (event.data.message || '');
            div.style.cssText = 'display:block;background:#f8d7da;color:#721c24;padding:15px;border-radius:6px;';
          }
          setTimeout(() => { div.style.display = 'none'; }, 3000);
        });
      }
    });

    // Prevent navigation except tabs
    document.querySelectorAll('a:not(.nav-tab)').forEach(a => {
      a.addEventListener('click', e => e.preventDefault());
    });
  </script>
</body>
</html>`;
}