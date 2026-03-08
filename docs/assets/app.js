const listEl = document.getElementById('report-list');
const bodyEl = document.getElementById('report-body');
const pdfEl = document.getElementById('download-pdf');
const mdEl = document.getElementById('open-md');

async function loadIndex() {
  const res = await fetch('./data/index.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('index.json 加载失败');
  return res.json();
}

function renderList(items, onPick) {
  listEl.innerHTML = '';
  items.forEach((it, idx) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = `${it.date} (${it.articleCount}篇)`;
    if (idx === 0) btn.classList.add('active');
    btn.onclick = () => {
      [...listEl.querySelectorAll('button')].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onPick(it);
    };
    li.appendChild(btn);
    listEl.appendChild(li);
  });
}

async function showReport(item) {
  const mdRes = await fetch(`./data/${item.md}`, { cache: 'no-store' });
  const md = await mdRes.text();
  bodyEl.innerHTML = marked.parse(md.replace(/^\ufeff/, ''));
  pdfEl.href = `./data/${item.pdf}`;
  mdEl.href = `./data/${item.md}`;
}

(async () => {
  try {
    const index = await loadIndex();
    if (!index.items?.length) {
      bodyEl.textContent = '暂无可展示报告';
      return;
    }
    renderList(index.items, showReport);
    await showReport(index.items[0]);
  } catch (e) {
    bodyEl.textContent = `加载失败：${e.message}`;
  }
})();