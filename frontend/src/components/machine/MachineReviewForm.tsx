import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { postMachineReview } from '../../api/axiosMachine';
import { Review } from '../../types/Machine';
import Rating from '@mui/material/Rating';
import Box from '@mui/material/Box';
import '../../assets/scss/machine/MachineReviewForm.scss';
import LoadingIcon from '../public/LoadingIcon';
import Modal from '../modal/Modal';

interface MachineReviewFormProps {
  onReviewAdded: (review: Review) => void;
  machineId: string;
  isModalOpen: boolean;
  onClose: () => void;
}

interface FormData {
  rating: number;
  difficulty: string;
  review: string;
}

const MachineReviewForm: React.FC<MachineReviewFormProps> = ({
  machineId,
  onReviewAdded,
  isModalOpen,
  onClose
}) => {
  const { t } = useTranslation('machine');
  const [formData, setFormData] = useState<FormData>({
    rating: 0,
    difficulty: '',
    review: '',
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const reviewContentRef = useRef<HTMLTextAreaElement>(null);

  const { rating, difficulty, review } = formData;

  const adjustTextareaHeight = () => {
    if (reviewContentRef.current) {
      reviewContentRef.current.style.height = 'auto';
      reviewContentRef.current.style.width = '100%';
      reviewContentRef.current.style.height = `${reviewContentRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [review]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: name === 'rating' ? parseFloat(value) : value,
    }));
  };

  const handleRatingChange = (_event: React.SyntheticEvent, newValue: number | null) => {
    setFormData((prevData) => ({
      ...prevData,
      rating: newValue || 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate rating
    if (rating < 1.0 || rating > 5.0) {
      setError(t('review.ratingError'));
      return;
    }

    // Validate one decimal place
    if (!Number.isInteger(rating * 10)) {
      setError(t('review.ratingDecimalError'));
      return;
    }

    // Validate difficulty
    if (!difficulty) {
      setError(t('review.difficultyError'));
      return;
    }

    if (!review.trim()) {
      setError(t('review.contentError'));
      return;
    }

    setLoading(true);
    try {
      const reviewData = {
        rating,
        review,
        difficulty
      };

      const newReview = await postMachineReview(machineId, reviewData);
      onReviewAdded(newReview);
      setFormData({ rating: 0, difficulty: '', review: '' });
      onClose(); // Close modal after successful submission
      window.location.reload(); // 성공했을 때만 새로고침
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.msg) {
        setError(err.response.data.msg);
      } else if (err.msg) {
        setError(err.msg);
      } else {
        setError(t('review.unknownError'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingIcon />;
  }

  return (
    <Modal isOpen={isModalOpen} onClose={onClose}>
      <form className='machine-review-form' onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>{t('review.newReview')}</h2>
        </div>

        {error && <p className='error-message'>{error}</p>}

        <div className='machine-review-form-rating'>
          <label htmlFor='rating' className='rating'>{t('review.qualityRating')}</label>
          <Box
            sx={{
              '& > legend': { mt: 2 },
            }}
          >
            <Rating
              name="rating"
              className="test"
              value={rating}
              precision={0.5}
              onChange={handleRatingChange}
            />
          </Box>
        </div>

        <div className='machine-review-form-difficulty'>
          <label htmlFor='difficulty'>{t('review.difficultyLevel')}</label>
          <select
            id='difficulty'
            name='difficulty'
            value={difficulty}
            onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
            required
            className='difficulty-select'
          >
            <option value="">{t('review.selectDifficulty')}</option>
            <option value="very_easy">⭐ {t('difficulty_levels.very_easy')}</option>
            <option value="easy">⭐⭐ {t('difficulty_levels.easy')}</option>
            <option value="medium">⭐⭐⭐ {t('difficulty_levels.medium')}</option>
            <option value="hard">⭐⭐⭐⭐ {t('difficulty_levels.hard')}</option>
            <option value="very_hard">⭐⭐⭐⭐⭐ {t('difficulty_levels.very_hard')}</option>
          </select>
        </div>

        <div className='machine-review-form-content'>
          <label htmlFor='review'>{t('review.comment')}</label>
          <textarea
            ref={reviewContentRef}
            id='review'
            name='review'
            value={review}
            placeholder={t('review.placeholder')}
            onChange={handleChange}
            required
          />
        </div>

        <div className="modal-footer">
          <button
            className='machine-review-form-submit'
            type='submit'
            disabled={loading}
          >
            {loading ? t('review.submitting') : t('review.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default MachineReviewForm;