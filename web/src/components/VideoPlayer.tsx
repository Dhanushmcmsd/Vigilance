import { useState } from 'react';

export function VideoPlayer({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="video-fallback">
        <div className="video-fallback-icon" aria-hidden>
          ⚠️
        </div>
        <p className="video-fallback-title">Cannot play in browser</p>
        <p className="video-fallback-subtitle">
          This video is in HEVC/H.265 format (recorded on iPhone). Download it to play in VLC or install
          HEVC codec on Windows.
        </p>
        <div className="video-fallback-actions">
          <a href={fileUrl} download={fileName} className="btn btn-primary">
            ⬇ Download Video
          </a>
          <a
            href="https://www.videolan.org/vlc/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Get VLC Player (Free)
          </a>
        </div>
      </div>
    );
  }

  return (
    <video
      controls
      width="100%"
      style={{ maxHeight: '400px', borderRadius: '8px', background: '#000' }}
      onError={() => setError(true)}
    >
      <source src={fileUrl} type="video/mp4" />
      <source src={fileUrl} type="video/quicktime" />
      <source src={fileUrl} type="video/x-m4v" />
      Your browser does not support this video format.{' '}
      <a href={fileUrl} download={fileName}>
        Download the video
      </a>
      .
    </video>
  );
}
