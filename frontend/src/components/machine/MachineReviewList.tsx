import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getMachineReviews } from '../../api/axiosMachine';
import '../../assets/scss/machine/MachineReviewList.scss';
import Rating from '@mui/material/Rating';
import Box from '@mui/material/Box';
import { Review } from '../../types/Machine';
import LoadingIcon from '../public/LoadingIcon';
import ErrorIcon from '../public/ErrorIcon';

interface MachineReviewListProps {
  machineId: string;
}

const MachineReviewList: React.FC<MachineReviewListProps> = ({ machineId }) => {
  const { t } = useTranslation('machine');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!machineId) {
        setError(t('details.missingId'));
        setLoading(false);
        return;
      }
      try {
        const data = await getMachineReviews(machineId);
        setReviews(data.reviews);
        setLoading(false);
      } catch (error: any) {
        setError(`Error fetching reviews: ${error.msg}`);
        setLoading(false);
      }
    };
    fetchReviews();
  }, [machineId, t]);

  if (loading) {
    return <LoadingIcon />;
  }

  if (error) {
    return <ErrorIcon />;
  }

  return (
    <div className='machine-review-list'>
      <div className='review-container'>
        <table className='machine-review-table'>
          {reviews.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={3} className='no-data'>{t('review.noReviewsShort')}</td>
              </tr>
            </tbody>
          ) : (
            <>
              <thead>
                <tr>
                  <th className='machine-review-username'>{t('review.user')}</th>
                  <th className='machine-review-rating'>{t('review.rating')}</th>
                  <th className='machine-review-comment'>{t('review.comment')}</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review._id}>
                    <td>{review.reviewerName}</td>
                    <td>
                      <Box
                        sx={{
                          '& > legend': { mt: 2 },
                        }}
                      >
                        <Rating
                          name={`read-only-rating-${review._id}`}
                          value={Number(review.rating)}
                          precision={0.5}
                          readOnly
                        />
                      </Box>
                    </td>
                    <td>{review.content}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  );
};

export default MachineReviewList;
