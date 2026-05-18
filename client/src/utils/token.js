export const getStoredToken = () => {
  try {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  } catch {
    return null;
  }
};

export const setStoredToken = (token) => {
  try {
    localStorage.setItem('token', token);
    sessionStorage.removeItem('token');
  } catch { }
};

export const clearStoredToken = () => {
  try {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
  } catch { }
};
