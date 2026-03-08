#!/usr/bin/env node
/**
 * HN Daily PDF Wrapper - 带 PDF 生成的完整自动化脚本
 * 
 * 默认生成 PDF 格式，支持多种格式选项
 */

import { execSync } from 'child_process';
import { writeFile, readFile, mkdir } from 'fs/promises';
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
    help: args.includes('--help') || args.includes('-h')
  };
}

async function main() {
  const options = parseArgs();
  
  if (options.help) {
    console.log(`
HN Daily Auto - 带 PDF 生成的完整自动化脚本

用法: node auto-digest-pdf.mjs [选项]

选项:
  --date <YYYY-MM-DD>    指定日期
  --format <pdf|md|html>  输出格式 [默认: pdf]
  --channel <id>         Discord 频道 ID
  --help, -h             显示帮助

示例:
  node auto-digest-pdf.mjs                    # 生成 PDF
  node auto-digest-pdf.mjs --format md        # 生成 Markdown
  node auto-digest-pdf.mjs --date 2026-03-07  # 指定日期
`);
    return;
  }
  
  console.log('🚀 HN Daily Auto (PDF Edition)\n');
  console.log(`📄 输出格式: ${options.format.toUpperCase()}\n`);
  
  // 1. 运行基础脚本生成 Markdown
  console.log('📡 步骤 1: 获取文章并生成 Markdown...');
  const dateArg = options.date ? `--date ${options.date}` : '';
  
  try {
    execSync(`node ${join(__dirname, 'auto-digest.mjs')} ${dateArg}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (e) {
    console.error('❌ 生成 Markdown 失败');
    process.exit(1);
  }
  
  // 2. 转换为 PDF（如果需要）
  if (options.format === 'pdf' || options.format === 'html') {
    console.log('\n📄 步骤 2: 转换格式...');
    
    // 确定要转换的文件
    const today = options.date || new Date().toISOString().split('T')[0];
    const mdPath = join(OUTPUT_DIR, `hn-daily-${today}.md`);
    
    try {
      const { convertMarkdownToPDF } = await import('./md-to-pdf.mjs');
      const outputPath = await convertMarkdownToPDF(mdPath, {
        format: options.format,
        title: `HN Daily ${today}`
      });
      
      console.log(`\n✅ 完成: ${outputPath}`);
      
      // 3. 发送文件到 Discord（如果配置了 channel）
      if (options.channel) {
        console.log('\n📤 准备发送到 Discord...');
        const filename = outputPath.split('/').pop();
        
        // 复制到当前目录
        const content = await readFile(outputPath, 'utf-8');
        await writeFile(`./${filename}`, content, 'utf-8');
        
        console.log(`\n💡 请执行以下命令发送文件:`);
        console.log(`   message --action send --filePath "./${filename}" --filename "${filename}" --message "📄 HN Daily ${today} 完整总结"`);
      }
    } catch (error) {
      console.error('❌ 转换失败:', error.message);
      console.log('📄 请使用 Markdown 格式:', mdPath);
    }
  }
}

main().catch(console.error);
