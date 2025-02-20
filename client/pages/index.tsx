import React from "react";
import AppleCard from "../components/AppleCard";

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Market Dashboard</h1>
          <AppleCard />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
