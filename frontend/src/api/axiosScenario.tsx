import axiosInstance from './axiosInit';


// ✅ 모든 시나리오 조회
export const getAllScenarios = async () => {
  const res = await axiosInstance.get('/arena/scenarios');
  return res.data;
};

// ✅ 특정 시나리오 조회
export const getScenarioById = async (id: string) => {
  const res = await axiosInstance.get(`/arena/scenarios/${id}`);
  return res.data;
};

// ✅ 시나리오 생성
export const createScenario = async (scenarioData: any) => {
  const res = await axiosInstance.post('/arena/scenarios', scenarioData);
  return res.data;
};

// ✅ 시나리오 수정
export const updateScenario = async (id: string, scenarioData: any) => {
  const res = await axiosInstance.put(`/arena/scenarios/${id}`, scenarioData);
  return res.data;
};

// ✅ 시나리오 삭제
export const deleteScenario = async (id: string) => {
  const res = await axiosInstance.delete(`/arena/scenarios/${id}`);
  return res.data;
};

// ✅ 시나리오 활성화/비활성화 토글
export const toggleScenarioActive = async (id: string, isActive: boolean) => {
  const res = await axiosInstance.patch(`/arena/scenarios/${id}/toggle`, { isActive });
  return res.data;
};

// ✅ 모드별 시나리오 조회
export const getScenariosByMode = async (mode: string) => {
  const res = await axiosInstance.get(`/arena/scenarios/mode/${mode}`);
  return res.data;
};

// ✅ 난이도별 시나리오 조회
export const getScenariosByDifficulty = async (mode: string, difficulty: string) => {
  const res = await axiosInstance.get(`/arena/scenarios/mode/${mode}/difficulty/${difficulty}`);
  return res.data;
};

// ✅ 시나리오 통계
export const getScenarioStats = async () => {
  const res = await axiosInstance.get('/arena/scenarios/stats');
  return res.data;
};