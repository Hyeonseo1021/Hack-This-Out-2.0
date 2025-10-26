import React, { useEffect, useState } from 'react';
import Main from '../../components/main/Main';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../assets/scss/learning/learningMainPage.scss';

interface Lesson {
  _id: string;
  title: string;
  description: string;
  category: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
  order: number;
  completed?: boolean;
}

const Learning: React.FC = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLessons();
  }, [filter]);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' 
        ? '/api/learning/lessons'
        : `/api/learning/lessons?category=${filter}`;
      
      const response = await axios.get(url);
      
      // API 응답 구조 확인 후 lessons 배열 추출
      const lessonsData = response.data.lessons || [];
      
      // 배열인지 확인
      if (Array.isArray(lessonsData)) {
        setLessons(lessonsData);
      } else {
        console.error('lessons가 배열이 아닙니다:', lessonsData);
        setLessons([]);
      }
    } catch (error) {
      console.error('레슨 불러오기 실패:', error);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      beginner: { text: '입문', color: '#4CAF50' },
      intermediate: { text: '중급', color: '#FF9800' },
      advanced: { text: '고급', color: '#F44336' }
    };
    return badges[category] || badges.beginner;
  };

  const handleLessonClick = (lessonId: string) => {
    navigate(`/learning/lesson/${lessonId}`);
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <Main>
    <div className="learning-container">
      <header className="learning-header">
        <h1>🎓 해킹 학습 센터</h1>
        <p>기초부터 고급까지, 단계별로 배우는 화이트햇 해킹</p>
      </header>

      <div className="filter-tabs">
        <button 
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          전체
        </button>
        <button 
          className={filter === 'beginner' ? 'active' : ''}
          onClick={() => setFilter('beginner')}
        >
          입문
        </button>
        <button 
          className={filter === 'intermediate' ? 'active' : ''}
          onClick={() => setFilter('intermediate')}
        >
          중급
        </button>
        <button 
          className={filter === 'advanced' ? 'active' : ''}
          onClick={() => setFilter('advanced')}
        >
          고급
        </button>
      </div>

      <div className="lessons-grid">
        {Array.isArray(lessons) && lessons.map((lesson) => {
          const badge = getCategoryBadge(lesson.category);
          return (
            <div 
              key={lesson._id} 
              className={`lesson-card ${lesson.completed ? 'completed' : ''}`}
              onClick={() => handleLessonClick(lesson._id)}
            >
              {lesson.completed && (
                <div className="completed-badge">✓ 완료</div>
              )}
              <div className="lesson-order">#{lesson.order}</div>
              <span 
                className="category-badge" 
                style={{ backgroundColor: badge.color }}
              >
                {badge.text}
              </span>
              <h3>{lesson.title}</h3>
              <p className="description">{lesson.description}</p>
              <div className="lesson-footer">
                <span className="time">⏱️ {lesson.estimatedTime}분</span>
                <button className="start-btn">
                  {lesson.completed ? '다시 보기' : '시작하기'} →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {lessons.length === 0 && (
        <div className="no-lessons">
          <p>😢 아직 레슨이 없습니다.</p>
        </div>
      )}
    </div>
  </Main>
  );
};

export default Learning;