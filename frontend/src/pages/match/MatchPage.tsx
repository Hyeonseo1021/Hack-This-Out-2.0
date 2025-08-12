import React from 'react';
import Main from '../../components/main/Main';
import { io } from 'socket.io-client';
import image from '../../assets/img/match/image.png';
import '../../assets/scss/match/MatchPage.scss';

const MatchPage: React.FC = () => {
    return (
        <Main>
            <div className="neon-frame"></div>

        </Main>
    )
}
export default MatchPage;