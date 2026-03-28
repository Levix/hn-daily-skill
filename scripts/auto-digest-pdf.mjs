#!/usr/bin/env node
/**
 * HN Daily PDF Wrapper - 带 PDF 生成的完整自动化脚本
 * 
 * 默认生成 PDF 格式，支持多种格式选项
 * 包含完整性检查机制
 */

import { execSync } from 'child_process';
import { copyFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

// 参数解析
function parseArgs() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };
  
  return {
    date: getArg('--date'),
    format: getArg('--format') || 'pdf', // 默认 PDF
    channel: getArg('--channel'),
    skipCheck: args.includes('--skip-check'), // 跳过检查
    help: args.includes('--help') || args.includes('-h')
  };
}

/**
 * 清理非完整版文件
 */
async function cleanupIncompleteFiles(date) {
  console.log('\n🧹 清理非完整版文件...');
  
  const filesToDelete = [
    `hn-daily-${date}-debug.html`,
    `hn-daily-${date}-detailed.md`,
    `hn-daily-${date}-detailed.pdf`,
    `hn-daily-${date}-detailed-debug.html`
  ];
  
  let deletedCount = 0;
  for (const filename of filesToDelete) {
    const filepath = join(OUTPUT_DIR, filename);
    if (existsSync(filepath)) {
      await unlink(filepath);
      console.log(`   🗑️  删除: ${filename}`);
      deletedCount++;
    }
  }
  
  if (deletedCount === 0) {
    console.log('   ✅ 无需清理');
  } else {
    console.log(`   ✅ 已清理 ${deletedCount} 个文件`);
  }
}

/**
 * 检查文档完整性
 */
async function checkCompleteness(mdPath) {
  console.log('\n🔍 步骤 3: 检查文档完整性...');
  
  try {
    const { checkDocumentCompleteness } = await import('./check-completeness.mjs');
    const result = await checkDocumentCompleteness(mdPath);
    
    console.log(`   文件大小: ${result.stats.fileSize} 字符`);
    console.log(`   文章数量: ${result.stats.articleCount} 篇`);
    console.log(`   章节完整性: ${result.stats.sectionsFound}/5`);
    
    if (!result.isComplete) {
      console.log('\n⚠️  文档不完整:');
      result.issues.forEach((issue, i) => {
        console.log(`      ${i + 1}. ${issue}`);
      });
      return false;
    }
    
    console.log('   ✅ 文档完整性检查通过');
    return true;
    
  } catch (error) {
    console.error('   ❌ 检查失败:', error.message);
    return false;
  }
}

/**
 * 生成完整版文档
 */
async function generateCompleteVersion(date) {
  console.log('\n📝 生成完整版文档...');
  console.log('   请手动创建完整版 Markdown 文件');
  console.log(`   文件路径: output/hn-daily-${date}-complete.md`);
  
  // 这里可以调用 AI 生成完整版
  console.log('\n💡 提示: 可以使用 AI 助手为每篇文章生成详细中文总结');
  console.log('   然后保存为 hn-daily-${date}-complete.md');
}

async function main() {
  const options = parseArgs();
  
  if (options.help) {
    console.log(`
HN Daily Auto - 带 PDF 生成的完整自动化脚本

用法: node auto-digest-pdf.mjs [选项]

选项:
  --date <YYYY-MM-DD>    指定日期（默认前一天）
  --format <pdf|md|html>  输出格式 [默认: pdf]
  --channel <id>         Discord 频道 ID
  --skip-check           跳过完整性检查
  --help, -h             显示帮助

示例:
  node auto-digest-pdf.mjs                    # 生成 PDF
  node auto-digest-pdf.mjs --format md        # 生成 Markdown
  node auto-digest-pdf.mjs --date 2026-03-07  # 指定日期
`);
    return;
  }
  
  // 默认取前一天（可被 --date 覆盖）
  const defaultDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();
  const today = options.date || defaultDate;

  console.log('🚀 HN Daily Auto (PDF Edition)\n');
  console.log(`📅 日期: ${today}（默认前一天）`);
  console.log(`📄 输出格式: ${options.format.toUpperCase()}`);
  if (options.skipCheck) {
    console.log('⏭️  跳过完整性检查');
  }
  console.log('');

  // 1. 运行基础脚本生成 Markdown
  console.log('📡 步骤 1: 获取文章并生成 Markdown...');
  const dateArg = `--date ${today}`;

  try {
    execSync(`node ${join(__dirname, 'auto-digest.mjs')} ${dateArg}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (e) {
    console.error('❌ 生成 Markdown 失败');
    process.exit(1);
  }
  
  // 2. 检查完整性（如果未跳过）
  const mdPath = join(OUTPUT_DIR, `hn-daily-${today}.md`);
  let isComplete = true;
  
  if (!options.skipCheck) {
    isComplete = await checkCompleteness(mdPath);
    
    if (!isComplete) {
      console.log('\n⚠️  检测到文档不完整');
      
      // 清理非完整版文件
      await cleanupIncompleteFiles(today);
      
      // 提示生成完整版
      await generateCompleteVersion(today);
      
      console.log('\n❌ 流程终止，请生成完整版后重试');
      console.log('   或使用 --skip-check 跳过检查');
      process.exit(1);
    }
  }
  
  // 3. 转换为 PDF（如果需要）
  if (options.format === 'pdf' || options.format === 'html') {
    console.log('\n📄 步骤 4: 转换格式...');
    
    try {
      const { convertMarkdownToPDF } = await import('./md-to-pdf.mjs');
      const outputPath = await convertMarkdownToPDF(mdPath, {
        format: options.format,
        title: `HN Daily ${today}`
      });
      
      console.log(`\n✅ 完成: ${outputPath}`);
      
      // 清理非完整版文件
      await cleanupIncompleteFiles(today);
      
      // 4. 发送文件到 Discord（如果配置了 channel）
      if (options.channel) {
        console.log('\n📤 准备发送到 Discord...');
        const filename = outputPath.split('/').pop();
        
        // 复制到当前目录，保持 PDF/HTML 的二进制内容不变
        await copyFile(outputPath, `./${filename}`);
        
        console.log(`\n💡 请执行以下命令发送文件:`);
        console.log(`   message --action send --filePath "./${filename}" --filename "${filename}" --message "📄 HN Daily ${today} 完整总结"`);
      }
    } catch (error) {
      console.error('❌ 转换失败:', error.message);
      console.log('📄 请使用 Markdown 格式:', mdPath);
    }
  } else {
    // Markdown 格式，也清理非完整版
    await cleanupIncompleteFiles(today);
  }
  
  console.log('\n✅ 流程完成');
}

main().catch(console.error);
