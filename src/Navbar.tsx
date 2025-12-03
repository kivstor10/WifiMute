import React from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";

const Navbar: React.FC = () => {
  const { signOut } = useAuthenticator();
  return (
    <nav>
      <div className="navbar-title">WiFiMuter</div>
      <button
        onClick={signOut}
        className="btn-sign-out"
      >
        Sign Out
      </button>
    </nav>
  );
};

export default Navbar;
