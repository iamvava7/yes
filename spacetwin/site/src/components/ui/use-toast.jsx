// Toast system with 5s auto-close + framer-motion exit effect + a always-visible
// close button. Inspired by react-hot-toast.
import { useState, useEffect } from "react";

const TOAST_LIMIT = 20;
const AUTO_CLOSE_MS = 5000; // disappear automatically after 5 seconds

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
};

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

const toastTimers = new Map();

function clearAutoClose(toastId) {
  const t = toastTimers.get(toastId);
  if (t) {
    clearTimeout(t);
    toastTimers.delete(toastId);
  }
}

function scheduleAutoClose(toastId) {
  clearAutoClose(toastId);
  const t = setTimeout(() => {
    toastTimers.delete(toastId);
    dispatch({ type: actionTypes.REMOVE_TOAST, toastId });
  }, AUTO_CLOSE_MS);
  toastTimers.set(toastId, t);
}

export const reducer = (state, action) => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        toastTimers.forEach((t) => clearTimeout(t));
        toastTimers.clear();
        return { ...state, toasts: [] };
      }
      clearAutoClose(action.toastId);
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };

    default:
      return state;
  }
};

const listeners = [];
let memoryState = { toasts: [] };

function dispatch(action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

function toast({ ...props }) {
  const id = genId();

  const update = (p) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...p, id },
    });

  const dismiss = () => {
    clearAutoClose(id);
    dispatch({ type: actionTypes.REMOVE_TOAST, toastId: id });
  };

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
    },
  });

  // auto-close after 5 seconds (framer-motion plays the exit effect)
  scheduleAutoClose(id);

  return { id, dismiss, update };
}

function useToast() {
  const [state, setState] = useState(memoryState);

  useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId) => {
      clearAutoClose(toastId);
      dispatch({ type: actionTypes.REMOVE_TOAST, toastId });
    },
  };
}

export { useToast, toast };