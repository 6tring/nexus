import React, { useRef } from 'react';

function ImportExport({ handleImport, handleExport }) {
  const fileInputRef = useRef(null);

  const onFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      await handleImport(file);
      // Reset the file input so the same file can be imported again if needed
      event.target.value = '';
    }
  };

  return (
    <div className="header-actions">
      <label className="import-btn">
        Import CSV
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
          hidden
        />
      </label>
      <button onClick={handleExport} className="export-btn">
        Export CSV
      </button>
    </div>
  );
}

export default ImportExport;