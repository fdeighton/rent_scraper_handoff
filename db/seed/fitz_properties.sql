-- fitz_properties: 13 rows. Load after schema.sql.
INSERT INTO public.fitz_properties (id, name, address, city, province, latitude, longitude, photo_url, year_built, unit_count, asset_type, benchmark_building_id, display_order, created_at) VALUES
  ('0fde1b78-d93d-45e1-bb6e-01f711ad3cf1', 'Senakw I', '1450 Pennyfarthing Dr', 'Vancouver', 'BC', 49.2725421, -123.1417742, NULL, 2026, 1409, 'PBR', '57cd310a-bf86-4cd2-93f4-11b3235ea714', 10, '2026-03-20T03:33:37.577887+00:00'),
  ('3234281f-a8d7-408f-90ff-1bb0a3540441', 'Collection - Sloane', '3450 Dufferin Ave', 'Toronto', 'ON', 43.7282, -79.4502, NULL, 2025, 518, 'PBR', 'a71141df-5893-4c11-99ab-250caa330263', 3, '2026-02-22T00:38:41.539618+00:00'),
  ('350459a5-cfa3-4dce-812b-6fc9f0b812e9', 'Collection - Parker', '200 Redpath Avenue', 'Toronto', 'ON', 43.7099696, -79.3936249, NULL, 2022, 349, 'PBR', 'eb384f15-38e8-4a11-89a4-ea8f311eb4d4', 2, '2026-02-13T19:12:54.105789+00:00'),
  ('37718f87-0a96-4f91-98d2-1ae45c2c0b7c', 'Dialogue PBR', '4235 Confederation Pkwy', 'Mississauga', 'ON', 43.5897825, -79.6503031, NULL, 2025, 428, 'PBR', '3d9510d2-34e5-4480-a2f6-08d118578d0a', 11, '2026-03-20T03:33:37.577887+00:00'),
  ('40052850-9d92-4281-a60a-741a8359b34f', 'Collection - Marlow', '980 Dufferin St', 'Toronto', 'ON', 43.6588048, -79.4354243, NULL, 2026, 214, NULL, '76e56464-b375-4840-bb79-6b5de3354321', 5, '2026-02-24T18:17:49.015853+00:00'),
  ('426e519c-607f-401d-8da0-03886574d68c', 'Loxley - Quartier Des Spectacles', '2100 Rue de Bleury', 'Montreal', 'QC', 45.5077686, -73.5704354, NULL, NULL, NULL, NULL, '9c29fbb3-9bf7-4c0a-aa99-40f392180f2f', 10, '2026-02-22T23:28:15.188812+00:00'),
  ('47883482-b58e-49bb-ae35-175d04807988', 'Collection - Elm Ledbury', '25 Dalhousie Street', 'Toronto', 'ON', 43.6538642, -79.3751991, NULL, NULL, NULL, NULL, '590cc3ce-e1be-47a5-89b9-6414885100c8', 1, '2026-02-18T17:46:30.560985+00:00'),
  ('644fd08b-73ad-43c4-a508-368c2b1c91a6', 'Dialogue Condo', '4235 Confederation Pkwy', 'Mississauga', 'ON', 43.5897825, -79.6503031, NULL, 2025, 428, 'Condo', '3d9510d2-34e5-4480-a2f6-08d118578d0a', 12, '2026-03-20T03:33:37.577887+00:00'),
  ('ce92f6c6-3aaa-406c-bb4d-493c9bb6de0d', 'Maddox - Tyndall', '115 & 135 Tyndall Ave', 'Toronto', 'ON', 43.6365575, -79.4283379, NULL, 1963, 325, 'PBR', 'f31809ed-c0d3-4e95-a92e-57abdf20bf5f', 8, '2026-02-24T16:52:30.811581+00:00'),
  ('d5cbd918-76be-4c16-b4ef-41d7129c81ed', 'Maddox - Cabbagetown', '191 Sherbourne Street', 'Toronto', 'ON', 43.6567888, -79.3699039, NULL, 1975, 596, 'PBR', 'd2643c1c-592e-4588-9862-4f2f247646f5', 6, '2026-02-24T16:52:16.774413+00:00'),
  ('d6d125ca-03a0-4b8b-924d-e05245811caf', 'Collection - Waverley', '484 Spadina Ave', 'Toronto', 'ON', 43.665561, -79.4029751, NULL, 2021, 166, 'PBR', '9b381273-ec80-472b-917e-163d21e89b05', 4, '2026-02-18T13:56:30.68652+00:00'),
  ('ece827ad-d98a-4ac1-a708-e0cf0938e1d6', 'Maddox - Dorchester', '1160 Rue Saint-Mathieu', 'Montreal', 'QC', 45.4923284, -73.5768932, NULL, 1970, 215, 'PBR', 'fcd253fd-9676-4e7a-b67e-b31bf24446f1', 7, '2026-02-24T16:52:47.151504+00:00'),
  ('ee82ea9a-eee4-4617-8f0c-5b5a08ba8b2d', 'Loxley - Mille Carrés', '2061 Rue Stanley', 'Montreal', 'QC', 45.5008234, -73.5761731, NULL, NULL, NULL, NULL, 'da417efc-d4a2-4b5b-9146-2c8ff019207f', 9, '2026-02-22T23:28:15.188812+00:00')
ON CONFLICT (id) DO NOTHING;

