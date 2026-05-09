"use client";

export default function TestBackground() {
  return (
    <div 
      className="fixed inset-0"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(45deg, #DC143C 0%, #470015 100%)',
        zIndex: -1,
      }}
    />
  );
}
