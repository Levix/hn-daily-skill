async function loadIndex() {
  const res = await fetch('./data/index.json');
  if (!res.ok) throw new Error('无法读取 data/index.json');
  return res.json();
}

async function loadMd(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('无法读取 ' + path);
  return res.text();
}

function renderList(items, onSelect) {
  const ul = document.getElementById('list');
  ul.innerHTML = '';
  items.forEach((it, idx) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.innerHTML = `<strong>${it.date}</strong><br><small>${it.articleCount || '-'} 篇</small>`;
    btn.onclick = () => onSelect(it, btn);
    if (idx === 0) btn.classList.add('active');
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function setActive(btn) {
  document.querySelectorAll('#list button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function showItem(item) {
  const md = await loadMd(item.md);
  document.getElementById('meta').textContent = `${item.date} · ${item.articleCount || '-'} 篇`;
  const rendered = marked.parse(md);
  document.getElementById('content').innerHTML = DOMPurify.sanitize(rendered);
  document.getElementById('pdfLink').innerHTML = item.pdf ? `<a href="${item.pdf}" target="_blank" rel="noopener">下载 PDF</a>` : '';
}

(async function boot(){
  try {
    const { items, generatedAt } = await loadIndex();
    if (!items || items.length === 0) {
      document.getElementById('content').textContent = '暂无日报内容';
      return;
    }

    renderList(items, async (it, btn) => {
      setActive(btn);
      await showItem(it);
    });

    await showItem(items[0]);
  } catch (e) {
    document.getElementById('content').textContent = '加载失败：' + e.message;
  }
})();
