import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // 리디렉션을 위한 useNavigate 가져오기
import '../../assets/scss/login/LoginPage.scss';
import LoginForm from '../../components/login/LoginForm'; 
import Modal from '../../components/modal/Modal'; // Modal 가져오기
import RegisterForm from '../../components/login/RegisterForm'; // RegisterForm 가져오기
import { AuthUserContext } from '../../contexts/AuthUserContext'; // AuthUserContext 가져오기
import Main from '../../components/main/Main';
import Loading from '../../components/public/Loading';

const LoginPage: React.FC = () => {
  const [isClicked, setIsClicked] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal 상태 관리
  const navigate = useNavigate(); // navigate 초기화
  const [, setIsTransitioning] = useState(false);
  const [, setIsPreGlitch] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // AuthUserContext 사용
  const authUserContext = useContext(AuthUserContext);

  if (!authUserContext) {
    throw new Error('AuthUserContext는 AuthUserProvider 내에서 사용해야 합니다.');
  }

  const { isLoggedIn, isLoading } = authUserContext;

  // 이미 로그인 된 상태일 경우 리디렉션 처리
  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      navigate('/', { state: { fromLogin: true } }); // 로그인 후 홈 화면으로 리디렉션, 상태 전달
    }
  }, [isLoggedIn, isLoading, navigate]);

  // 배경 클릭 핸들러
  const handleBackgroundClick = () => {
    // pre-glitch 효과 시작
    setIsPreGlitch(true);
    
    // pre-glitch 후 메인 전환 시작
    setTimeout(() => {
      setIsPreGlitch(false);
      setIsTransitioning(true);
      
      // 전환이 시작된 후 상태 업데이트
      setTimeout(() => {
        setIsClicked(!isClicked);
        setIsTransitioning(false);
      }, 1200);
    }, 800);
  };

  // 회원가입 모달 열기
  const openModal = () => {
    setIsModalOpen(true);
  };

  // 회원가입 모달 닫기
  const closeModal = () => {
    setIsModalOpen(false);
  };

  // 인증 상태를 확인하는 동안 로딩 화면을 표시할 수 있음
  if (isLoading) {
    return (
      <Main title="Login" description="로그인 페이지 로딩 중.">
        <div className="login-page loading">
          <Loading />
        </div>
      </Main>
    );
  }

  // ✅ 수정된 return 블록
  return (
    <div>
      <div
        ref={containerRef}
        className={`background-image ${1 ? 'change-background' : ''} ${1 ? 'transitioning' : ''} ${1 ? 'pre-glitch' : ''}`}
        onClick={handleBackgroundClick}
      >
        <Loading />
      </div>
      <div className={1 ? "content-wrapper visible" : "content-wrapper"}>
        <LoginForm openRegisterModal={openModal} /> {/* LoginForm에 모달 열기 함수 전달 */}
      </div>

      {/* 회원가입 Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <RegisterForm closeRegisterModal={closeModal}/>
      </Modal>
    </div>
  );
};

export default LoginPage;