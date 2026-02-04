const { spawn } = require('child_process');
const path = require('path');

const ytdlpPath = path.join(__dirname, 'resources/bin/win/yt-dlp.exe');
const testUrl = 'https://www.youtube.com/watch?v=l5ggH-YhuAw';

console.log('Testing yt-dlp extraction with spawn...');
console.log('yt-dlp path:', ytdlpPath);
console.log('URL:', testUrl);

const args = [
  testUrl,
  '--dump-single-json',
  '--no-check-certificates',
  '--no-warnings',
  '--prefer-free-formats',
  '--format', 'best[ext=mp4]/best'
];

const proc = spawn(ytdlpPath, args, { windowsHide: true });

let stdout = '';
let stderr = '';

proc.stdout.on('data', (data) => {
  stdout += data.toString();
});

proc.stderr.on('data', (data) => {
  stderr += data.toString();
});

proc.on('error', (err) => {
  console.error('\n=== SPAWN ERROR ===');
  console.error(err);
});

proc.on('close', (code) => {
  console.log('\n=== Process exited with code:', code, '===');

  if (code !== 0) {
    console.error('stderr:', stderr);
    return;
  }

  try {
    const output = JSON.parse(stdout);
    console.log('Title:', output.title);

    let videoUrl = output.url;
    if (!videoUrl && output.requested_formats && output.requested_formats.length > 0) {
      const vf = output.requested_formats.find(f => f.vcodec && f.vcodec !== 'none');
      videoUrl = vf ? vf.url : output.requested_formats[0].url;
    }

    if (videoUrl) {
      console.log('\n=== SUCCESS ===');
      console.log('Video URL:', videoUrl.substring(0, 100) + '...');
    } else {
      console.log('\n=== NO URL FOUND ===');
    }
  } catch (e) {
    console.error('Parse error:', e.message);
  }
});
