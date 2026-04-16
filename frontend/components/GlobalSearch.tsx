import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Fuse from "fuse.js";
import { useAuth } from "../context/AuthContext";
import { fetchMinimalStudents, type StudentMinimalRecord } from "../lib/global-search";

const GlobalSearch: React.FC = () => {
  const { session, snapshot } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentMinimalRecord[]>([]);
  const [students, setStudents] = useState<StudentMinimalRecord[]>([]);
  const [fuse, setFuse] = useState<Fuse<StudentMinimalRecord> | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSearch = snapshot?.appUser.role === 'admin' || snapshot?.appUser.role === 'teacher' || snapshot?.appUser.role === 'homeroom';

  useEffect(() => {
    if (session?.access_token && canSearch) {
      fetchMinimalStudents(session.access_token).then((data) => {
        setStudents(data);
        setFuse(
          new Fuse(data, {
            keys: ["name", "nis", "className"],
            threshold: 0.3,
          })
        );
      });
    }
  }, [session, canSearch]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setResults([]);
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (canSearch) {
          handleOpen();
        }
      }
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpen, handleClose, canSearch]);

  useEffect(() => {
    if (fuse && query) {
      const searchResults = fuse.search(query).map((r) => r.item).slice(0, 8);
      setResults(searchResults);
      setSelectedIndex(0);
    } else {
      setResults([]);
    }
  }, [fuse, query]);

  const handleSelect = (student: StudentMinimalRecord) => {
    handleClose();
    // Redirect to dashboard with search query or directly to student if we had a student page
    // For now, redirecting to dashboard and setting search is the best we can do with existing routes
    router.push({
      pathname: '/dashboard',
      query: { search: student.name }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="search-overlay" onClick={handleClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Cari nama, NIS, atau kelas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="search-esc-hint">ESC</span>
        </div>
        
        <div className="search-results">
          {query === "" && (
            <div className="search-empty-state">
              Ketik untuk mulai mencari di antara {students.length} siswa...
            </div>
          )}
          {query !== "" && results.length === 0 && (
            <div className="search-empty-state">
              Tidak ada hasil untuk "{query}"
            </div>
          )}
          {results.map((student, index) => (
            <div
              key={student.id}
              className={`search-result-item ${index === selectedIndex ? "is-selected" : ""}`}
              onClick={() => handleSelect(student)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="search-result-info">
                <span className="search-result-name">{student.name}</span>
                <span className="search-result-meta">
                  {student.className} | NIS {student.nis}
                </span>
              </div>
              <svg className="search-result-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          ))}
        </div>
        
        <div className="search-footer">
          <div className="search-commands">
            <span className="search-command">
              <kbd>↵</kbd> Pilih
            </span>
            <span className="search-command">
              <kbd>↓</kbd>
              <kbd>↑</kbd> Navigasi
            </span>
          </div>
          <span className="search-badge">Pencarian Global</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
