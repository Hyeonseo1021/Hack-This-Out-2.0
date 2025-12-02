import React, { useRef, useState, useEffect } from 'react';
import '../../assets/scss/components/BackgroundMusic.scss';

const BackgroundMusic: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((err) => {
          console.log('재생 실패:', err);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  return (
    <div
      className='bgm-controller'
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <audio ref={audioRef} src='/audio/bgm.mp3' loop preload='auto' />

      <button className={`bgm-toggle ${isPlaying ? 'playing' : ''}`} onClick={togglePlay}>
        {isPlaying ? '🔊' : '🔇'}
      </button>

      {showControls && (
        <div className='bgm-panel'>
          <span className='bgm-label'>BGM</span>
          <input
            type='range'
            min='0'
            max='1'
            step='0.1'
            value={volume}
            onChange={handleVolumeChange}
            className='bgm-slider'
          />
          <span className='bgm-volume'>{Math.round(volume * 100)}%</span>
        </div>
      )}
    </div>
  );
};

export default BackgroundMusic;
