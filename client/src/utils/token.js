export const getStoredToken = () => {
  try {
    return sessionStorage.getItem('token') || localStorage.getItem('token');
  } catch {
    return null;
  }
};

export const setStoredToken = (token) => {
  try {
    sessionStorage.setItem('token', token);
    localStorage.removeItem('token');
  } catch {}
};

export const clearStoredToken = () => {
  try {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
  } catch {}
};
