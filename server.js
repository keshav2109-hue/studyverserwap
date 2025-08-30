const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Enable CORS for all originsnpm
app.use(cors());

// For Vercel compatibility
const PORT = process.env.PORT || 3000;

// Proxy for .m3u8 playlists
app.get('/proxy', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  try {
    const response = await axios.get(url, {
      headers: {
        "accept": "*/*",
        "Referer": "https://appx-play.akamai.net.in/"
      }
    });

    // Rewrite segment URLs in the playlist
    const base = url.substring(0, url.lastIndexOf('/') + 1);
    const playlist = response.data.replace(
      /^(?!#)([^\r\n]+)$/gm,
      (line) => {
        if (line.startsWith('http') || line.startsWith('#')) return line;
        // Encode base and file for proxying
        return `/segment?base=${encodeURIComponent(base)}&file=${encodeURIComponent(line)}`;
      }
    );

    res.setHeader('content-type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(playlist);
  } catch (err) {
    res.status(500).send('Proxy error: ' + err.message);
  }
});

// Proxy for .ts segments
app.get('/segment', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { base, file } = req.query;
  if (!base || !file) return res.status(400).send('Missing base or file parameter');

  const segmentUrl = base + file;
  try {
    const response = await axios.get(segmentUrl, {
      headers: {
        "accept": "*/*",
        "Referer": "https://appx-play.akamai.net.in/"
      },
      responseType: 'stream'
    });

    res.status(response.status);
    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send('Proxy error: ' + err.message);
  }
});

// For local dev, listen; for Vercel, export handler
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
  });
}
