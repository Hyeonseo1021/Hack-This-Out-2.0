import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Loading from './components/public/Loading';
import BackgroundMusic from './components/public/BackgroundMusic';

const App: React.FC = () => {
  return (
    <>
      <BackgroundMusic />
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </>
  );
};

export default App;
