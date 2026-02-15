/**
 * MetricsPanel Component
 * 
 * Displays real-time workout metrics (TSS, IF, Duration, etc.)
 * Includes zone distribution visualization and editable FTP.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useMetrics, useFTP, useBlocks, useWorkoutBuilderStore } from '../store';
import { formatDuration, getZoneForPower, calculateZoneDistribution } from '../utils';
import { POWER_ZONES } from '../constants';

export const MetricsPanel: React.FC = () => {
  const metrics = useMetrics();
  const ftp = useFTP();
  const blocks = useBlocks();
  const { setFTP } = useWorkoutBuilderStore();
  const [editingFTP, setEditingFTP] = useState(false);
  const [ftpInput, setFtpInput] = useState(String(ftp));

  // Calculate zone distribution
  const zoneDistribution = useMemo(() => 
    calculateZoneDistribution(blocks),
    [blocks]
  );

  const handleFTPClick = useCallback(() => {
    setFtpInput(String(ftp));
    setEditingFTP(true);
  }, [ftp]);

  const handleFTPBlur = useCallback(() => {
    const newFTP = parseInt(ftpInput, 10);
    if (!isNaN(newFTP) && newFTP >= 50 && newFTP <= 500) {
      setFTP(newFTP);
    } else {
      setFtpInput(String(ftp));
    }
    setEditingFTP(false);
  }, [ftpInput, ftp, setFTP]);

  const handleFTPKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFTPBlur();
    } else if (e.key === 'Escape') {
      setFtpInput(String(ftp));
      setEditingFTP(false);
    }
  }, [handleFTPBlur, ftp]);

  return (
    <div className="metrics-panel">
      <div className="metric">
        <span className="metric-label">Duration</span>
        <span className="metric-value">{formatDuration(metrics.duration)}</span>
      </div>

      <div className="metric">
        <span className="metric-label">TSS</span>
        <span className="metric-value">{metrics.tss}</span>
      </div>

      <div className="metric">
        <span className="metric-label">IF</span>
        <span className="metric-value">{metrics.intensityFactor.toFixed(2)}</span>
      </div>

      <div className="metric">
        <span className="metric-label">NP</span>
        <span className="metric-value">{metrics.normalizedPower}W</span>
      </div>

      <div className="metric">
        <span className="metric-label">Work</span>
        <span className="metric-value">{metrics.kilojoules}kJ</span>
      </div>

      <div className="metric metric-ftp" onClick={handleFTPClick} title="Click to edit FTP">
        <span className="metric-label">FTP</span>
        {editingFTP ? (
          <input
            type="number"
            className="ftp-input"
            value={ftpInput}
            onChange={(e) => setFtpInput(e.target.value)}
            onBlur={handleFTPBlur}
            onKeyDown={handleFTPKeyDown}
            autoFocus
            min={50}
            max={500}
          />
        ) : (
          <span className="metric-value metric-value-editable">{ftp}W</span>
        )}
      </div>

      {/* Zone Distribution */}
      <div className="zone-distribution" title="Time in each training zone">
        <span className="metric-label">Zones</span>
        <div className="zone-bar">
          {POWER_ZONES.map((zone, index) => {
            const time = zoneDistribution[index] || 0;
            const pct = metrics.duration > 0 ? (time / metrics.duration) * 100 : 0;
            if (pct < 1) return null;
            return (
              <div
                key={zone.name}
                className="zone-segment"
                style={{
                  width: `${pct}%`,
                  backgroundColor: zone.color,
                }}
                title={`${zone.name}: ${formatDuration(time)} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>
      </div>

      <style>{`
        .metrics-panel {
          display: flex;
          gap: 16px;
          padding: 8px 16px;
          background: #0d0d1a;
          border-top: 1px solid #333;
          flex-wrap: wrap;
          justify-content: center;
        }

        .metric {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 60px;
        }

        .metric-label {
          font-size: 9px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .metric-value {
          font-size: 16px;
          font-weight: bold;
          color: #fff;
          font-family: monospace;
        }

        .metric-ftp {
          padding-left: 16px;
          border-left: 1px solid #333;
          cursor: pointer;
        }

        .metric-ftp:hover .metric-value-editable {
          color: #00bfff;
        }

        .metric-value-editable {
          transition: color 0.15s;
        }

        .ftp-input {
          width: 50px;
          font-size: 16px;
          font-weight: bold;
          font-family: monospace;
          background: #222;
          border: 1px solid #00bfff;
          color: #fff;
          text-align: center;
          border-radius: 3px;
          padding: 2px;
        }

        .ftp-input:focus {
          outline: none;
        }

        .zone-distribution {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 120px;
          padding-left: 16px;
          border-left: 1px solid #333;
        }

        .zone-bar {
          display: flex;
          width: 100%;
          height: 16px;
          border-radius: 3px;
          overflow: hidden;
          background: #222;
        }

        .zone-segment {
          height: 100%;
          min-width: 2px;
          transition: width 0.3s ease;
        }

        @media (max-width: 500px) {
          .metrics-panel {
            gap: 10px;
          }
          .metric-value {
            font-size: 14px;
          }
          .zone-distribution {
            width: 100%;
            padding-left: 0;
            border-left: none;
            padding-top: 8px;
            border-top: 1px solid #333;
          }
          .zone-bar {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default MetricsPanel;
