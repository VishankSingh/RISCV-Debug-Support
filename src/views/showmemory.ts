import * as vscode from 'vscode';

function showMemoryDumpAsWebview(memoryDump: Record<string, string>): void {
  const panel = vscode.window.createWebviewPanel(
    'memoryDumpView',
    'VM Memory Dump',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewHtml(memoryDump);
}


function getWebviewHtml(memoryDump: Record<string, string>): string {
  const data = JSON.stringify(Object.entries(memoryDump));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: monospace;
      padding: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      padding-top: 10px;
    }
    th, td {
      padding: 6px 12px;
      border: 1px solid rgba(255, 255, 255, 0.59);
      text-align: left;
    }
    th {
      background-color:rgb(37, 37, 37);
      position: sticky;
      top: 0;
    }
    #controls {
      margin-bottom: 10px;
    }
     button {
      margin-right: 10px;
      padding: 8px 16px;
      background-color: rgb(37, 37, 37);
      color: white;
      border: none;
      cursor: pointer;
      transition: background-color 0.3s ease, transform 0.2s ease;
    }
    button:hover {
      background-color: rgb(60, 60, 60);
    }
    button:active {
      background-color: rgb(80, 80, 80);
    }
  </style>
</head>
<body>
  <h2>VM Memory Dump</h2>
  <div id="controls">
    <button onclick="prevPage()">Previous</button>
    <span id="pageInfo"></span>
    <button onclick="nextPage()">Next</button>
    <button onclick="toggleSort()">Toggle Sort</button>
  </div>
  <table>
    <thead>
      <tr>
        <th>Address</th>
        <th>Bytes</th>
        <th>Raw Hex</th>
      </tr>
    </thead>
    <tbody id="memoryTable"></tbody>
  </table>

  <script>
    const memoryEntries = ${data};
    let currentPage = 0;
    const pageSize = 25;
    let ascending = true;

    function formatBytes(hex64) {
      const hex = hex64.startsWith("0x") ? hex64.slice(2) : hex64;
      const padded = hex.padStart(16, '0');
      const bytes = padded.match(/.{2}/g);
      return bytes.reverse().join(' ');
    }

    function renderPage() {
      const sorted = memoryEntries.slice().sort((a, b) => {
        const aVal = parseInt(a[0], 16);
        const bVal = parseInt(b[0], 16);
        return ascending ? aVal - bVal : bVal - aVal;
      });

      const start = currentPage * pageSize;
      const page = sorted.slice(start, start + pageSize);

      const table = document.getElementById('memoryTable');
      table.innerHTML = '';
      for (const [addr, hex] of page) {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${addr}</td>
          <td>\${formatBytes(hex)}</td>
          <td>\${hex}</td>
        \`;
        table.appendChild(tr);
      }

      document.getElementById('pageInfo').textContent =
        \`Page \${currentPage + 1} of \${Math.ceil(memoryEntries.length / pageSize)}\`;
    }

    function nextPage() {
      if ((currentPage + 1) * pageSize < memoryEntries.length) {
        currentPage++;
        renderPage();
      }
    }

    function prevPage() {
      if (currentPage > 0) {
        currentPage--;
        renderPage();
      }
    }

    function toggleSort() {
      ascending = !ascending;
      renderPage();
    }

    renderPage();
  </script>
</body>
</html>`;
}


export {
  showMemoryDumpAsWebview
};