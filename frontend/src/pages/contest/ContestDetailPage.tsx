import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Main from "../../components/main/Main";

import {
  getContestDetails,
  getContestStatus,
  getLeaderboardByContest,
  getMyRankinContest,
} from "../../api/axiosContest";

import ContestDetail from "../../components/contest/ContestDetail";
import ContestLeaderboard from "../../components/leaderboard/ContestLeaderboard";

import { ContestDetail as ContestDetailType } from "../../types/Contest";
import { CurrentUser } from "../../types/CurrentUser";
import { ContestStatus } from "../../types/Contest";
import { User } from "../../types/User";

import styles from "../../assets/scss/contest/ContestDetailPage.module.scss";
import Loading from "../../components/public/Loading";
import ContestEndedMD from "../../components/modal/ContestEndedMD";
import ContestPendingMD from "../../components/modal/ContestPendingMD";

const ContestDetailPage: React.FC = () => {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();

  const [contestDetail, setContestDetail] = useState<ContestDetailType | null>(null);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [contestStatus, setContestStatus] = useState<ContestStatus>({
    isActive: false,
    isStarted: false,
    isEnded: false,
  });

  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    _id: null,
    myRank: null,
    myLevel: null,
    myExp: null,
    myUsername: null,
    myAvatar: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEndedMD, setShowEndedMD] = useState(false);
  const [showPendingMD, setShowPendingMD] = useState(false);

  /* ----------------------------------
     FETCH DETAIL
  ---------------------------------- */
  useEffect(() => {
    const fetchDetail = async () => {
      if (!contestId) return;
      try {
        const data = await getContestDetails(contestId);
        const c = data.contest;

        setContestDetail({
          ...c,
          startTime: new Date(c.startTime),
          endTime: new Date(c.endTime),
        });
      } catch {
        setError("Failed to load contest details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [contestId]);

  /* ----------------------------------
     FETCH LEADERBOARD
  ---------------------------------- */
  useEffect(() => {
    if (!contestId) return;
    const loadLeaderboard = async () => {
      try {
        const result = await getLeaderboardByContest(contestId);
        setLeaderboard(result.users);
      } catch {
        setError("Failed to load leaderboard.");
      }
    };
    loadLeaderboard();
  }, [contestId]);

  /* ----------------------------------
     FETCH USER RANK
  ---------------------------------- */
  useEffect(() => {
    if (!contestId) return;

    const loadRank = async () => {
      try {
        const res = await getMyRankinContest(contestId);
        setCurrentUser({
          _id: res.user._id,
          myRank: res.myRank,
          myLevel: res.user.level,
          myExp: res.expEarned,
          myUsername: res.user.username,
          myAvatar: res.user.avatar,
        });
      } catch {
        setError("Failed to load user rank.");
      }
    };
    loadRank();
  }, [contestId]);

  /* ----------------------------------
     FETCH STATUS
  ---------------------------------- */
  useEffect(() => {
    if (!contestId) return;

    const loadStatus = async () => {
      try {
        const status = await getContestStatus(contestId);
        setContestStatus(status);
      } catch {
        setError("Failed to load contest status.");
      }
    };
    loadStatus();
  }, [contestId]);

  /* ----------------------------------
     JOIN BUTTON
  ---------------------------------- */
  const handleJoin = () => {
    if (!contestDetail) return;

    const now = Date.now();
    const start = new Date(contestDetail.startTime).getTime();
    const end = new Date(contestDetail.endTime).getTime();

    if (now >= start && now <= end) {
      navigate(`/contest/${contestDetail._id}/pre`);
    } else if (now > end) {
      setShowEndedMD(true);
    } else {
      setShowPendingMD(true);
    }
  };

  /* ----------------------------------
     LOADING / ERROR
  ---------------------------------- */
  if (isLoading) return <Loading />;
  if (error || !contestDetail)
    return (
      <Main title="Contest Detail">
        <p className={styles.error_message}>{error || "Contest Not Found"}</p>
      </Main>
    );

  /* ----------------------------------
     RENDER
  ---------------------------------- */
  return (
    <Main title="Contest Detail">
      <div className={styles.page_wrapper}>

        <div className={styles.top_box}>
          <ContestDetail contestDetail={contestDetail} />

          <button className={styles.join_button} onClick={handleJoin}>
            JOIN
          </button>
        </div>

        {contestStatus.isActive && contestStatus.isStarted && (
          <div className={styles.leaderboard_box}>
            <ContestLeaderboard
              leaderboard={leaderboard}
              currentUser={currentUser}
            />
          </div>
        )}
      </div>

      {showEndedMD && <ContestEndedMD onClose={() => setShowEndedMD(false)} />}
      {showPendingMD && <ContestPendingMD onClose={() => setShowPendingMD(false)} />}
    </Main>
  );
};

export default ContestDetailPage;
