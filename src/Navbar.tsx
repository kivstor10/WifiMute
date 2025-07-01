import React from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";

const Navbar: React.FC = () => {
  const { signOut } = useAuthenticator();
  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f5f5f5' }}>
      <div style={{ fontWeight: 'bold' }}>WiFiMuter</div>
      <button
        onClick={signOut}
        style={{ padding: '0.5rem 1rem', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        Sign Out
      </button>
    </nav>
  );
};

export default Navbar;
