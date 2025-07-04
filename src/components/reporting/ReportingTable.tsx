import { useStatsDashboard } from "@/hooks/useStatsDashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  IconButton,
  Box,
  Chip,
  Tooltip,
  useTheme,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import EqualIcon from "@mui/icons-material/DragHandle";

export default function ReportingTable() {
  const stats = useStatsDashboard();
  const theme = useTheme();

  const maxDay = Math.max(...stats.missionsByDay.map((d) => d.missions));
  const minDay = Math.min(...stats.missionsByDay.map((d) => d.missions));

  const getComparisonIcon = (current, previous) => {
    if (current > previous) return <ArrowUpwardIcon color="success" fontSize="small" />;
    if (current < previous) return <ArrowDownwardIcon color="error" fontSize="small" />;
    return <EqualIcon color="info" fontSize="small" />;
  };

  const sectionStyles = {
    days: { background: theme.palette.primary.light, color: theme.palette.primary.contrastText },
    status: { background: theme.palette.warning.light, color: theme.palette.warning.contrastText },
    sectors: { background: theme.palette.info.light, color: theme.palette.info.contrastText },
    totals: { background: theme.palette.grey[200], fontWeight: "bold" },
  };

  return (
    <Paper sx={{ width: "100%", overflowX: "auto", p: 3, borderRadius: 2, boxShadow: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          Reporting Hebdomadaire
        </Typography>
        <Tooltip title="Actualiser les données">
          <IconButton onClick={() => window.location.reload()} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <TableContainer>
        <Table size="small" sx={{ minWidth: 1200 }}>
          <TableHead>
            <TableRow>
              <TableCell rowSpan={2} sx={{ ...sectionStyles.totals, minWidth: 120 }}>
                Semaine
              </TableCell>
              
              {/* Jours */}
              <TableCell colSpan={7} align="center" sx={{ ...sectionStyles.days, fontWeight: "bold" }}>
                <Box display="flex" alignItems="center" justifyContent="center">
                  <Typography variant="subtitle1">Jours de la semaine</Typography>
                </Box>
              </TableCell>
              
              {/* Statuts */}
              <TableCell colSpan={8} align="center" sx={{ ...sectionStyles.status, fontWeight: "bold" }}>
                <Typography variant="subtitle1">Statuts des missions</Typography>
              </TableCell>
              
              {/* Secteurs */}
              <TableCell colSpan={5} align="center" sx={{ ...sectionStyles.sectors, fontWeight: "bold" }}>
                <Typography variant="subtitle1">Répartition par secteurs</Typography>
              </TableCell>
              
              {/* Totaux */}
              <TableCell rowSpan={2} align="center" sx={{ ...sectionStyles.totals, minWidth: 100 }}>
                Total
              </TableCell>
              <TableCell rowSpan={2} align="center" sx={{ ...sectionStyles.totals, minWidth: 120 }}>
                Comparatif N-1
              </TableCell>
            </TableRow>
            
            <TableRow>
              {/* En-têtes jours */}
              {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((d) => (
                <TableCell key={d} align="center" sx={{ fontWeight: "bold" }}>
                  {d}
                </TableCell>
              ))}
              
              {/* En-têtes statuts */}
              {["Validé","En recherche","Non pourvue","Annulé Client","Annulé Int","Annulé ADA","Absence","Demandées"].map((s) => (
                <TableCell key={s} align="center" sx={{ fontWeight: "bold" }}>
                  {s.split(" ")[0]}
                </TableCell>
              ))}
              
              {/* En-têtes secteurs */}
              {["Étages","Cuisine","Salle","Plonge","Réception"].map((s) => (
                <TableCell key={s} align="center" sx={{ fontWeight: "bold" }}>
                  {s}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold" }}>
                <Box display="flex" flexDirection="column">
                  <span>Semaine {stats.positionSemaine}</span>
                  <Chip 
                    label={`${new Date().getFullYear()}`} 
                    size="small" 
                    sx={{ mt: 0.5, width: 'fit-content' }} 
                  />
                </Box>
              </TableCell>
              
              {/* Cellules jours */}
              {stats.missionsByDay.map((day) => (
                <TableCell
                  key={day.day}
                  align="center"
                  sx={{
                    fontWeight: "bold",
                    backgroundColor:
                      day.missions === maxDay
                        ? theme.palette.success.light
                        : day.missions === minDay
                        ? theme.palette.error.light
                        : "inherit",
                    color:
                      day.missions === maxDay || day.missions === minDay
                        ? theme.palette.getContrastText(
                            day.missions === maxDay
                              ? theme.palette.success.light
                              : theme.palette.error.light
                          )
                        : "inherit",
                  }}
                >
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <span>{day.missions}</span>
                    {day.missions === maxDay && (
                      <Chip
                        icon={<ArrowUpwardIcon />}
                        label="Max"
                        size="small"
                        sx={{ mt: 0.5, bgcolor: theme.palette.success.main, color: 'white' }}
                      />
                    )}
                    {day.missions === minDay && (
                      <Chip
                        icon={<ArrowDownwardIcon />}
                        label="Min"
                        size="small"
                        sx={{ mt: 0.5, bgcolor: theme.palette.error.main, color: 'white' }}
                      />
                    )}
                  </Box>
                </TableCell>
              ))}
              
              {/* Cellules statuts */}
              {[
                "Validé","En recherche","Non pourvue","Annule Client","Annule Int","Annule ADA","Absence","Demandées"
              ].map((s) => (
                <TableCell key={s} align="center">
                  {stats.statsByStatus[s] ?? 0}
                </TableCell>
              ))}
              
              {/* Cellules secteurs */}
              {stats.repartitionSecteurs.map((s) => (
                <TableCell key={s.secteur} align="center">
                  {s.missions}
                </TableCell>
              ))}
              
              {/* Cellules totaux */}
              <TableCell align="center" sx={{ fontWeight: "bold", fontSize: '1.1rem' }}>
                {stats.missionsSemaine}
              </TableCell>
              
              <TableCell align="center">
                <Box display="flex" alignItems="center" justifyContent="center">
                  {getComparisonIcon(stats.missionsSemaine, stats.missionsSemaineN1)}
                  <Box ml={1}>
                    {stats.missionsSemaineN1} 
                    <Typography variant="caption" display="block" color="textSecondary">
                      (N-1)
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box mt={2} display="flex" justifyContent="flex-end">
        <Typography variant="caption" color="textSecondary">
          Données mises à jour le {new Date().toLocaleDateString()}
        </Typography>
      </Box>
    </Paper>
  );
}