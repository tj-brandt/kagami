// /components/ConditionSelector.jsx
import React from 'react';

const conditions = [
  { label: "No Avatar, Active LSM", value: { avatar: false, lsm: true, key: "no-avatar-active" } },
  { label: "Static Avatar, Active LSM", value: { avatar: true, lsm: true, key: "static-avatar-active" } },
  { label: "No Avatar, Static LSM", value: { avatar: false, lsm: false, key: "no-avatar-static" } },
  { label: "No Avatar, Static LSM", value: { avatar: false, lsm: false, stopSign: true, key: "no-avatar-stop" } },
  { label: "Static Avatar, Static LSM", value: { avatar: true, lsm: false, key: "static-avatar-static" } },
  { label: "Avatar + LSM", value: { avatar: true, lsm: true, stopSign: true, key: "avatar-lsm" } }
];

export default function ConditionSelector({ onSelect }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-8 py-12">
      <h1 className="text-3xl font-bold mb-8">Choose Your Chatbot Condition</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {conditions.map((cond, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(cond.value)}
            className="bg-blue-600 text-white px-6 py-4 rounded-lg shadow-md hover:bg-blue-700 transition text-center"
          >
            {cond.label}
          </button>
        ))}
      </div>
    </div>
  );
}
