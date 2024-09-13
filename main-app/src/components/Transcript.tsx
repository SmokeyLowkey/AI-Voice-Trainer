import React from "react";

// Define the props type
interface TranscriptProps {
  transcript: string | null;
}

const Transcript: React.FC<TranscriptProps> = ({ transcript }) => {
  return (
    <div className="mt-5 bg-gray-100 rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-3">Transcription</h2>
      <div className="border border-gray-300 p-4 bg-white rounded-md text-gray-800 font-sans text-lg leading-relaxed whitespace-pre-wrap">
        {transcript || "No transcription available yet."}
      </div>
    </div>
  );
};

export default Transcript;
