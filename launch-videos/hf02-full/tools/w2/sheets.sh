#!/bin/bash
# Reference vs ours compare sheets: every ~10th frame plus each cut/handoff ±2 (within our ranges), 12 rows per sheet.
cd "$(dirname "$0")"
R=../../ref/frames; O=../../out/w2
P="python3 -E ../cmp.py"
$P $R $O/f1 $O/cmp_p1_1.png 95,96,97,105,111,115,123,125,126,127,135,145 400
$P $R $O/f1 $O/cmp_p1_2.png 155,165,175,185,195,205,208,210,215,225,228,230 400
$P $R $O/f1 $O/cmp_p1_3.png 231,232,233,234,240,245,246,250,255,261,262,263 400
$P $R $O/f2 $O/cmp_p2_1.png 1529,1530,1531,1535,1541,1545,1550,1553,1565,1575,1585,1590 400
$P $R $O/f2 $O/cmp_p2_2.png 1591,1592,1593,1595,1605,1615,1626,1627,1628,1629,1630,1631 400
$P $R $O/f2 $O/cmp_car.png 1640,1650,1660,1670,1680,1685,1690,1693,1695,1696,1697,1629 400
